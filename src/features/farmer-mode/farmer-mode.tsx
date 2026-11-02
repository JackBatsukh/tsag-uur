"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { BrandMark } from "@/components/icons";
import { DynamicWeatherMap } from "@/features/map";
import {
  syntheticWeatherProvider,
  WEATHER_LAYER_DEFINITIONS,
  WIND_DIRECTION_LABELS_MN,
} from "@/features/weather-data";
import type { WeatherLayerId } from "@/features/weather-data";

import {
  assessAgriculturalRisks,
  buildFieldworkAdvisory,
  buildHarvestAdvisory,
  buildIrrigationAdvisory,
  buildPlantingAdvisory,
  rankHarvestWeatherWindows,
  sumForecastPrecipitation,
} from "./advisory-engine";
import {
  CROP_CONFIG,
  DEFAULT_FARM_FIELD,
  GROWTH_STAGE_LABELS_MN,
  IRRIGATION_METHOD_LABELS_MN,
  MATURITY_LABELS_MN,
  NOTE_KIND_LABELS_MN,
  SOIL_TYPE_LABELS_MN,
} from "./config";
import {
  FARMER_DEMO_SCENARIOS,
  getFarmerDemoScenario,
} from "./demo-scenarios";
import {
  createDefaultFarmerLocalState,
  FARMER_LOCAL_STORAGE_KEY,
  parseFarmerLocalState,
  serializeFarmerLocalState,
} from "./storage";
import type {
  AdvisoryResult,
  CropGrowthStage,
  CropMaturityObservation,
  CropType,
  FarmField,
  FieldNote,
  FieldNoteKind,
  IrrigationMethod,
  SoilType,
} from "./types";
import { WeatherCharts } from "./weather-charts";

const LITE_MODE_KEY = "tsag-uur-lite-mode";
const LITE_MODE_EVENT = "tsag-uur-lite-mode-change";

function subscribeToLiteMode(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LITE_MODE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LITE_MODE_EVENT, callback);
  };
}

function getLiteMode(): boolean {
  return window.localStorage.getItem(LITE_MODE_KEY) === "true";
}

function setSharedLiteMode(enabled: boolean): void {
  window.localStorage.setItem(LITE_MODE_KEY, String(enabled));
  window.dispatchEvent(new Event(LITE_MODE_EVENT));
}

function formatDate(value: string): string {
  const milliseconds = Date.parse(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(milliseconds)) return value;
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(milliseconds));
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function weatherImplication(day: (typeof FARMER_DEMO_SCENARIOS)[number]["days"][number]): string {
  if (day.minimumTemperatureC <= 2) return "Хярууны боломжийг талбай дээр шалгах";
  if (day.precipitationMm >= 5) return "Талбай нойтон байж болох өдөр";
  if (day.maximumWindSpeedMps >= 10) return "Шүршилт, талбайн ажилд салхитай";
  if (day.maximumTemperatureC >= 28 && day.minimumRelativeHumidityPercent < 35) return "Халуун, хуурайшуулах нөхцөл";
  return "Ердийн талбайн ажлыг газар дээр шалгах";
}

function AdvisoryCard({ advisory }: { readonly advisory: AdvisoryResult }) {
  return (
    <article className="farmer-advisory-card" data-level={advisory.level}>
      <div className="farmer-card-heading">
        <div>
          <span className="farmer-status-chip">{advisory.level === "favorable" ? "БОЛОМЖТОЙ DEMO" : advisory.level === "avoid" ? "ТОХИРОМЖГҮЙ DEMO" : advisory.level === "insufficient" ? "МЭДЭЭЛЭЛ ДУТУУ" : "ШАЛГАХ DEMO"}</span>
          <h3>{advisory.titleMn}</h3>
        </div>
        <span className="illustrative-chip">Illustrative</span>
      </div>
      <p className="advisory-summary">{advisory.summaryMn}</p>
      <div className="advisory-columns">
        <div><h4>Яагаад?</h4><ul>{advisory.explanationMn.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h4>Ашигласан мэдээлэл</h4><ul>{advisory.supportingMeasurementsMn.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h4>Дутуу мэдээлэл</h4>{advisory.missingInputsMn.length ? <ul>{advisory.missingInputsMn.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Үндсэн хэрэглэгчийн оролт бүрдсэн.</p>}</div>
      </div>
      <details>
        <summary>Хязгаарлалт ба эх сурвалж</summary>
        <p>{advisory.sourceMn}</p>
        <ul>{advisory.uncertaintyMn.map((item) => <li key={item}>{item}</li>)}</ul>
        <small>Хүчинтэй хугацаа: {advisory.validityPeriod.from} — {advisory.validityPeriod.until}</small>
      </details>
    </article>
  );
}

export function FarmerMode() {
  const [scenarioId, setScenarioId] = useState(FARMER_DEMO_SCENARIOS[0]!.id);
  const scenario = getFarmerDemoScenario(scenarioId);
  const [field, setField] = useState<FarmField>(() => ({
    ...DEFAULT_FARM_FIELD,
    location: { ...scenario.location },
  }));
  const [notes, setNotes] = useState<readonly FieldNote[]>([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [newNoteKind, setNewNoteKind] = useState<FieldNoteKind>("crop-condition");
  const [newNoteDate, setNewNoteDate] = useState(scenario.days[0]?.validDate ?? "2026-06-15");
  const [newNoteText, setNewNoteText] = useState("");
  const [activeMapLayer, setActiveMapLayer] = useState<WeatherLayerId>("precipitation");
  const [mapTimeIndex, setMapTimeIndex] = useState(0);
  const liteMode = useSyncExternalStore(subscribeToLiteMode, getLiteMode, () => true);

  useEffect(() => {
    const parsed = parseFarmerLocalState(window.localStorage.getItem(FARMER_LOCAL_STORAGE_KEY));
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setField(parsed.state.field);
      setNotes(parsed.state.notes);
      if (parsed.recovered) setStorageMessage(parsed.messageMn);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const irrigation = useMemo(() => buildIrrigationAdvisory(scenario, field), [scenario, field]);
  const harvest = useMemo(() => buildHarvestAdvisory(scenario, field), [scenario, field]);
  const planting = useMemo(() => buildPlantingAdvisory(scenario, field), [scenario, field]);
  const fieldwork = useMemo(() => buildFieldworkAdvisory(scenario), [scenario]);
  const harvestWindows = useMemo(() => rankHarvestWeatherWindows(scenario, field), [scenario, field]);
  const risks = useMemo(() => assessAgriculturalRisks(scenario), [scenario]);
  const totalRain = sumForecastPrecipitation(scenario.days);
  const maximumWind = Math.max(...scenario.days.map((day) => day.maximumWindSpeedMps));
  const minimumTemperature = Math.min(...scenario.days.map((day) => day.minimumTemperatureC));
  const mapTimeStep = syntheticWeatherProvider.timeSteps[mapTimeIndex] ?? syntheticWeatherProvider.timeSteps[0]!;

  const updateField = <K extends keyof FarmField>(key: K, value: FarmField[K]) => {
    setField((current) => ({ ...current, [key]: value }));
    setStorageMessage("");
  };

  const saveLocalState = () => {
    const state = { version: 1 as const, field, notes };
    window.localStorage.setItem(FARMER_LOCAL_STORAGE_KEY, serializeFarmerLocalState(state));
    setStorageMessage("Талбай ба тэмдэглэлийг зөвхөн энэ browser-д хадгаллаа.");
  };

  const resetLocalState = () => {
    const reset = createDefaultFarmerLocalState();
    window.localStorage.removeItem(FARMER_LOCAL_STORAGE_KEY);
    setField({ ...reset.field, location: { ...scenario.location } });
    setNotes([]);
    setStorageMessage("Local талбай ба тэмдэглэлийг устгаж demo утгаар сэргээв.");
  };

  const addNote = () => {
    if (!newNoteText.trim()) {
      setStorageMessage("Тэмдэглэлийн утгаа оруулна уу.");
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`;
    setNotes((current) => [...current, { id, kind: newNoteKind, date: newNoteDate, text: newNoteText.trim() }]);
    setNewNoteText("");
    setStorageMessage("Тэмдэглэлийг жагсаалтад нэмлээ. Хадгалах товчийг дарж localStorage-д бичнэ.");
  };

  return (
    <div className="farmer-app" id="top">
      <a className="skip-link" href="#farmer-main">Үндсэн агуулга руу алгасах</a>
      <header className="farmer-header">
        <Link className="farmer-brand" href="/" aria-label="Tsag-uur нүүр">
          <span><BrandMark /></span>
          <div><strong>Tsag-uur</strong><small>Farmer Intelligence</small></div>
        </Link>
        <nav aria-label="Үндсэн цэс">
          <Link href="/">Цаг агаар</Link>
          <Link href="/herder">Малчин</Link>
          <Link href="/farmer" aria-current="page">Тариаланч</Link>
          <Link href="/dashboard">Текстэн самбар</Link>
        </nav>
        <label className="farmer-lite-toggle">
          <span>Lite</span>
          <input type="checkbox" checked={liteMode} onChange={(event) => setSharedLiteMode(event.target.checked)} />
        </label>
      </header>

      <div className="farmer-demo-banner" role="note">
        <strong>DEMO</strong>
        <span>Зохиомол өгөгдөл. Бодит тариалангийн шийдвэрт ашиглахгүй.</span>
        <span>Зөвлөмж бүр тайлбарлах зориулалттай.</span>
      </div>

      <main className="farmer-main" id="farmer-main">
        <section className="farmer-hero">
          <div>
            <p className="farmer-eyebrow">Тариалангийн шийдвэрийн туслах</p>
            <h1>Цаг агаарын мэдээг<br /><span>талбайн ажил</span> болгох</h1>
            <p>Усалгаа, ургац хураалт, тариалалт, хяруу ба талбайн ажлын боломжийг 7 хоногийн deterministic demo өгөгдлөөр тайлбарлана.</p>
            <div className="hero-actions"><a href="#irrigation">Усалгааны үнэлгээ</a><a href="#my-field">Миний талбай</a></div>
          </div>
          <aside>
            <span>Одоогийн demo талбай</span>
            <strong>{scenario.locationNameMn}</strong>
            <dl>
              <div><dt>Хүчинтэй</dt><dd>{scenario.provenance.validFrom.slice(0, 10)} — {scenario.provenance.validUntil.slice(0, 10)}</dd></div>
              <div><dt>Төлөв</dt><dd>Synthetic · баталгаажаагүй</dd></div>
              <div><dt>Grid</dt><dd>~{scenario.provenance.nominalResolutionKm} км demo</dd></div>
            </dl>
          </aside>
        </section>

        <section className="farmer-scenario-panel" aria-labelledby="scenario-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">Сонгох demo</p><h2 id="scenario-heading">Тариалангийн нөхцөл</h2></div><p>Тогтмол үр дүнтэй 5 жишээгээр advisory engine-ийг шалгана.</p></div>
          <div className="farmer-scenario-grid">
            {FARMER_DEMO_SCENARIOS.map((item) => (
              <button key={item.id} type="button" data-active={item.id === scenario.id} aria-pressed={item.id === scenario.id} onClick={() => {
                setScenarioId(item.id);
                setNewNoteDate(item.days[0]?.validDate ?? newNoteDate);
              }}>
                <strong>{item.labelMn}</strong><span>{item.summaryMn}</span><small>{item.locationNameMn}</small>
              </button>
            ))}
          </div>
        </section>

        <section id="farmer-overview" className="farmer-overview" aria-labelledby="overview-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">1 · Тариалангийн тойм</p><h2 id="overview-heading">7 хоногийг нэг дор</h2></div><p>{scenario.summaryMn}</p></div>
          <div className="farmer-metric-grid">
            <article><span>Хур тунадасны нийлбэр</span><strong>{totalRain.toFixed(1)} мм</strong><small>Өдөр тутмын interval утгын нийлбэр</small></article>
            <article><span>Хамгийн бага температур</span><strong>{minimumTemperature.toFixed(0)}°C</strong><small>2 м-ийн synthetic air temperature</small></article>
            <article><span>Хамгийн их салхи</span><strong>{maximumWind.toFixed(1)} м/с</strong><small>Өдрийн maximum demo утга</small></article>
            <article><span>Борооны магадлал</span><strong>Өгөгдөлгүй</strong><small>Deterministic хэмжээг probability болгоогүй</small></article>
          </div>
          <div className="provenance-strip">
            <div><span>Эх сурвалж</span><strong>{scenario.provenance.sourceMn}</strong></div>
            <div><span>Үүсгэсэн</span><strong>{scenario.provenance.generatedAt}</strong></div>
            <div><span>Статус</span><strong>DEMO · шинжлэх ухаанаар баталгаажаагүй</strong></div>
          </div>
        </section>

        <section id="farmer-forecast" className="farmer-forecast" aria-labelledby="forecast-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">2 · Ирэх 7 хоног</p><h2 id="forecast-heading">Өдөр тутмын цаг агаар ба талбайн утга</h2></div><p>Огноо бүрийн хүчинтэй хугацаа Asia/Ulaanbaatar өдрөөр.</p></div>
          <div className="farmer-day-list">
            {scenario.days.map((day) => (
              <article key={day.id} data-condition={day.condition}>
                <time dateTime={day.validDate}>{formatDate(day.validDate)}</time>
                <div className="day-temperature"><strong>{day.maximumTemperatureC.toFixed(0)}°</strong><span>{day.minimumTemperatureC.toFixed(0)}° min</span></div>
                <dl>
                  <div><dt>Бороо</dt><dd>{day.precipitationMm.toFixed(1)} мм</dd></div>
                  <div><dt>Магадлал</dt><dd>{day.precipitationProbabilityPercent === null ? "Өгөгдөлгүй" : `${day.precipitationProbabilityPercent}%`}</dd></div>
                  <div><dt>Салхи</dt><dd>{day.maximumWindSpeedMps.toFixed(1)} м/с · {WIND_DIRECTION_LABELS_MN[day.windDirectionCardinal]}</dd></div>
                  <div><dt>Чийг</dt><dd>{day.minimumRelativeHumidityPercent}–{day.maximumRelativeHumidityPercent}%</dd></div>
                </dl>
                <p>{weatherImplication(day)}</p>
              </article>
            ))}
          </div>
          <WeatherCharts days={scenario.days} />
        </section>

        <section id="irrigation" className="farmer-advisory-section" aria-labelledby="irrigation-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">3 · Усалгааны зөвлөмж</p><h2 id="irrigation-heading">Хөрсний чийгийг орлохгүй weather-based assessment</h2></div></div>
          <AdvisoryCard advisory={irrigation} />
        </section>

        <section className="farmer-advisory-section" aria-labelledby="harvest-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">4 · Ургац хураалт</p><h2 id="harvest-heading">Цаг агаарын боломжит цонх</h2></div></div>
          <AdvisoryCard advisory={harvest} />
          <div className="weather-window-grid">
            {harvestWindows.slice(0, 3).map((window, index) => (
              <article key={window.date} data-level={window.level}>
                <span>#{index + 1} · score {window.score}</span>
                <h3>{formatDate(window.date)}</h3>
                <strong>{window.maturityConfirmed ? "Болцын ажиглалт: бэлэн" : "Ургацын боловсролт баталгаажаагүй"}</strong>
                <ul>{window.advantagesMn.map((item) => <li key={item}>{item}</li>)}</ul>
                {window.concernsMn.length ? <details><summary>Анхаарах зүйл</summary><ul>{window.concernsMn.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="farmer-risk-section" aria-labelledby="risk-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">5 · Хяруу ба эрсдэл</p><h2 id="risk-heading">Албан анхааруулга биш — тайлбарлах demo screen</h2></div><p>2 м-ийн air temperature-ийг навч эсвэл хөрсний гадаргын температур гэж үзээгүй.</p></div>
          <div className="farmer-risk-grid">
            {risks.map((risk) => (
              <article key={risk.kind} data-level={risk.level}>
                <span>{risk.level === "favorable" ? "ОНЦГОЙ ДОХИОГҮЙ" : risk.level === "avoid" ? "АНХААРАХ DEMO" : "ШАЛГАХ DEMO"}</span>
                <h3>{risk.labelMn}</h3><strong>{risk.valueMn}</strong><p>{risk.explanationMn}</p>
                {risk.affectedDates.length ? <small>{risk.affectedDates.join(" · ")}</small> : null}
                <details><summary>Эх сурвалж ба хязгаарлалт</summary><p>{risk.sourceMn}</p><p>{risk.limitationMn}</p></details>
              </article>
            ))}
          </div>
        </section>

        <section id="my-field" className="farmer-field-section" aria-labelledby="field-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">6 · Миний талбай</p><h2 id="field-heading">Талбай ба таримлын local тохиргоо</h2></div><p>Нарийвчилсан байршил сервер рүү илгээгдэхгүй; зөвхөн энэ browser-ийн localStorage-д хадгална.</p></div>
          <div className="farmer-field-layout">
            <form className="farmer-field-form" onSubmit={(event) => event.preventDefault()}>
              <label><span>Талбайн нэр</span><input value={field.name} maxLength={120} onChange={(event) => updateField("name", event.target.value)} /></label>
              <label><span>Талбайн хэмжээ · га (заавал биш)</span><input type="number" min="0.01" step="0.01" value={field.areaHa ?? ""} placeholder="Мэдэхгүй бол хоосон" onChange={(event) => updateField("areaHa", parseOptionalNumber(event.target.value))} /></label>
              <label><span>Таримал</span><select value={field.cropType} onChange={(event) => updateField("cropType", event.target.value as CropType)}>{Object.values(CROP_CONFIG).map((crop) => <option key={crop.id} value={crop.id}>{crop.labelMn}</option>)}</select></label>
              <label><span>Ургалтын үе шат</span><select value={field.growthStage} onChange={(event) => updateField("growthStage", event.target.value as CropGrowthStage)}>{Object.entries(GROWTH_STAGE_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Тариалсан огноо</span><input type="date" value={field.plantingDate ?? ""} onChange={(event) => updateField("plantingDate", event.target.value || null)} /></label>
              <label><span>Хөрсний төрөл</span><select value={field.soilType} onChange={(event) => updateField("soilType", event.target.value as SoilType)}>{Object.entries(SOIL_TYPE_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Усалгааны арга</span><select value={field.irrigationMethod} onChange={(event) => updateField("irrigationMethod", event.target.value as IrrigationMethod)}>{Object.entries(IRRIGATION_METHOD_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Сүүлийн усалгаа</span><input type="date" value={field.lastIrrigationDate ?? ""} onChange={(event) => updateField("lastIrrigationDate", event.target.value || null)} /></label>
              <label><span>Хэмжсэн хөрсний чийг · %</span><input type="number" min="0" max="100" step="0.1" value={field.measuredSoilMoisturePercent ?? ""} placeholder="Мэдрэгчгүй бол хоосон" onChange={(event) => updateField("measuredSoilMoisturePercent", parseOptionalNumber(event.target.value))} /></label>
              <label><span>Хэмжсэн бороо · мм</span><input type="number" min="0" step="0.1" value={field.measuredRainfallMm ?? ""} placeholder="Ажиглалтгүй бол хоосон" onChange={(event) => updateField("measuredRainfallMm", parseOptionalNumber(event.target.value))} /></label>
              <label className="field-form-wide"><span>Ургацын болцын ажиглалт</span><select value={field.maturityObservation} onChange={(event) => updateField("maturityObservation", event.target.value as CropMaturityObservation)}>{Object.entries(MATURITY_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <fieldset className="field-location-inputs field-form-wide"><legend>Байршил</legend><label><span>Өргөрөг</span><input type="number" min="41.3" max="52.2" step="0.001" value={field.location?.latitude ?? ""} onChange={(event) => updateField("location", { latitude: Number(event.target.value), longitude: field.location?.longitude ?? 106.92 })} /></label><label><span>Уртраг</span><input type="number" min="87.5" max="120" step="0.001" value={field.location?.longitude ?? ""} onChange={(event) => updateField("location", { latitude: field.location?.latitude ?? 47.58, longitude: Number(event.target.value) })} /></label><small>Доорх MapLibre зураг дээр дарж сонгож болно. Кадастрын хил биш.</small></fieldset>
              <div className="field-form-actions field-form-wide"><button type="button" className="farmer-primary-button" onClick={saveLocalState}>Энэ browser-д хадгалах</button><button type="button" className="farmer-danger-button" onClick={resetLocalState}>Local мэдээллийг устгах</button></div>
              {storageMessage ? <p className="field-form-message field-form-wide" role="status">{storageMessage}</p> : null}
            </form>

            <aside className="field-summary-card">
              <span>Талбайн профайл</span><h3>{field.name || "Нэргүй талбай"}</h3>
              <dl><div><dt>Таримал</dt><dd>{CROP_CONFIG[field.cropType].labelMn}</dd></div><div><dt>Үе шат</dt><dd>{GROWTH_STAGE_LABELS_MN[field.growthStage]}</dd></div><div><dt>Хөрс</dt><dd>{SOIL_TYPE_LABELS_MN[field.soilType]}</dd></div><div><dt>Усалгаа</dt><dd>{IRRIGATION_METHOD_LABELS_MN[field.irrigationMethod]}</dd></div><div><dt>Байршил</dt><dd>{field.location ? `${field.location.latitude.toFixed(3)}, ${field.location.longitude.toFixed(3)}` : "Мэдэхгүй"}</dd></div></dl>
              <p>{CROP_CONFIG[field.cropType].descriptionMn}</p>
            </aside>
          </div>

          <div className="field-notes-panel">
            <div><p className="farmer-eyebrow">Local тэмдэглэл</p><h3>Талбайн ажлын түүх</h3></div>
            <div className="field-note-form"><label><span>Төрөл</span><select value={newNoteKind} onChange={(event) => setNewNoteKind(event.target.value as FieldNoteKind)}>{Object.entries(NOTE_KIND_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Огноо</span><input type="date" value={newNoteDate} onChange={(event) => setNewNoteDate(event.target.value)} /></label><label className="field-note-text"><span>Тэмдэглэл</span><textarea rows={2} maxLength={2000} value={newNoteText} onChange={(event) => setNewNoteText(event.target.value)} /></label><button type="button" onClick={addNote}>Тэмдэглэл нэмэх</button></div>
            <div className="field-note-list">{notes.length ? notes.map((note) => <article key={note.id}><div><span>{NOTE_KIND_LABELS_MN[note.kind]}</span><time dateTime={note.date}>{note.date}</time></div><p>{note.text}</p><button type="button" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}>Устгах</button></article>) : <p className="empty-note-state">Одоогоор local тэмдэглэл алга.</p>}</div>
          </div>
        </section>

        <section id="farmer-map" className="farmer-map-section" aria-labelledby="map-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">7 · Цаг агаарын газрын зураг</p><h2 id="map-heading">Талбайн цэг ба weather overlay</h2></div><p>Одоогийн synthetic provider-ийг дахин ашиглана; scenario cards-ийн өдөр тутмын dataset-тэй ижил эх үүсвэр биш.</p></div>
          <div className="farmer-map-controls">
            <div role="group" aria-label="Газрын зургийн давхарга">{WEATHER_LAYER_DEFINITIONS.map((layer) => <button key={layer.id} type="button" aria-pressed={activeMapLayer === layer.id} onClick={() => setActiveMapLayer(layer.id)}>{layer.shortLabelMn}</button>)}</div>
            <label><span>Provider цаг: {mapTimeStep.labelMn}</span><input type="range" min="0" max={syntheticWeatherProvider.timeSteps.length - 1} value={mapTimeIndex} onChange={(event) => setMapTimeIndex(Number(event.target.value))} /></label>
          </div>
          <div className="farmer-map-frame">
            {!liteMode ? (
              <DynamicWeatherMap provider={syntheticWeatherProvider} activeLayer={activeMapLayer} timeSelector={mapTimeStep.id} selectedCoordinates={field.location} onSelectCoordinates={(location) => updateField("location", location)} showWindParticles={activeMapLayer === "wind-speed"} />
            ) : (
              <div className="farmer-lite-map"><strong>Lite Mode · MapLibre ачаалаагүй</strong><p>Талбайн координат: {field.location ? `${field.location.latitude.toFixed(3)}, ${field.location.longitude.toFixed(3)}` : "сонгоогүй"}</p><button type="button" onClick={() => setSharedLiteMode(false)}>Интерактив зураг нээх</button></div>
            )}
          </div>
          <p className="map-privacy-note">Тэмдэглэгээ нь хэрэглэгчийн сонгосон цэг; бодит кадастрын хил, тариалангийн баталгаажсан талбай биш. Серверт хадгалахгүй.</p>
        </section>

        <section className="farmer-planner-section" aria-labelledby="planner-heading">
          <div className="section-heading"><div><p className="farmer-eyebrow">Нэмэлт төлөвлөгч</p><h2 id="planner-heading">Тариалалт ба ерөнхий талбайн ажил</h2></div></div>
          <div className="farmer-planner-grid"><AdvisoryCard advisory={planting} /><AdvisoryCard advisory={fieldwork} /></div>
        </section>

        <section className="farmer-trust-section" aria-labelledby="trust-heading">
          <div><p className="farmer-eyebrow">Өгөгдлийн ил тод байдал</p><h2 id="trust-heading">Юуг тооцсон, юуг тооцоогүй вэ?</h2></div>
          <div className="farmer-trust-grid">
            <article><h3>Одоогийн demo</h3><ul><li>5 deterministic scenario, 7 өдөр</li><li>Interval хур тунадасны зөв нийлбэр</li><li>Температур, салхи, чийгийн тайлбарлах screen</li><li>Local талбай ба тэмдэглэл</li></ul></article>
            <article><h3>Тооцоогүй</h3><ul><li>FAO-56 ET₀, Kc, crop water requirement</li><li>Хөрсний усны баланс ба үндэсний гүн</li><li>Бодит sensor soil moisture</li><li>Албан анхааруулга ба calibrated probability</li></ul></article>
            <article><h3>Судалгааны суурь</h3><ul><li><a href="https://www.fao.org/4/X0490E/X0490E00.htm">FAO-56 crop evapotranspiration</a></li><li><a href="https://www.fao.org/4/y7223e/y7223e0b.htm">FAO frost protection guide</a></li><li><a href="https://www.fao.org/giews/countrybrief/country/MNG/pdf_archive/MNG_Archive.pdf">FAO/GIEWS Mongolia crop calendar</a></li><li><a href="https://ulaanbaatar.namem.gov.mn/khuduu/">УЦУОШТ агро цаг уур</a></li></ul></article>
          </div>
          <p className="farmer-final-warning">Аливаа усалгаа, тариалалт, хяруу хамгаалалт, ургац хураалтын шийдвэрийг талбайн хэмжилт, агрономичийн зөвлөгөө, албан цаг агаарын мэдээлэлтэй тулгаж гаргана.</p>
        </section>
      </main>

      <nav className="farmer-mobile-nav" aria-label="Тариаланч горимын хурдан цэс">
        <a href="#farmer-overview"><span aria-hidden="true">▦</span>Тойм</a>
        <a href="#farmer-forecast"><span aria-hidden="true">☁</span>7 хоног</a>
        <a href="#my-field"><span aria-hidden="true">⌖</span>Талбай</a>
        <a href="#farmer-map"><span aria-hidden="true">◇</span>Зураг</a>
      </nav>

      <footer className="farmer-footer"><span>Tsag-uur · Тариаланч горимын DEMO</span><Link href="/">Цаг агаарын зураг</Link><a href="#top">Дээш очих</a></footer>
    </div>
  );
}
