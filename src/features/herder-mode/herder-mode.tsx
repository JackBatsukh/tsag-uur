"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { BrandMark } from "@/components/icons";
import { WIND_DIRECTION_LABELS_MN } from "@/features/weather-data";
import { cardinalFromDegrees } from "@/features/weather-data/interpolation";

import { SPECIES_CONFIG, TERRAIN_LABELS_MN } from "./config";
import {
  HERDER_DEMO_METADATA,
  HERDER_DEMO_SCENARIOS,
  getDemoScenario,
  splitWeatherPeriods,
} from "./demo-scenarios";
import { DynamicHerderMap } from "./dynamic-herder-map";
import { assessWeatherRisks } from "./risk-assessment";
import { analyzeHistoricalWeather, buildSearchAreas } from "./search-heuristics";
import type {
  AnimalSpecies,
  HerderDemoScenario,
  HerderWeatherStep,
  MissingLivestockReport,
  TerrainContext,
  WeatherPeriod,
} from "./types";

const LOCAL_REPORT_KEY = "tsag-uur-herder-private-report-v1";
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

const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000;

function formatDateTime(value: string | null): string {
  if (!value) return "Өгөгдөлгүй";
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "Огноо буруу";
  const local = new Date(milliseconds + ULAANBAATAR_OFFSET_MS);
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = String(local.getUTCHours()).padStart(2, "0");
  const minute = String(local.getUTCMinutes()).padStart(2, "0");
  return `${month}-р сарын ${day} · ${hour}:${minute}`;
}

function toLocalInputValue(iso: string): string {
  const milliseconds = Date.parse(iso);
  if (!Number.isFinite(milliseconds)) return "";
  const local = new Date(milliseconds + ULAANBAATAR_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  const hour = String(local.getUTCHours()).padStart(2, "0");
  const minute = String(local.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromLocalInputValue(value: string): string {
  const parsed = Date.parse(`${value}:00+08:00`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

function reportForScenario(scenario: HerderDemoScenario): MissingLivestockReport {
  return {
    species: scenario.defaultSpecies,
    count: scenario.defaultCount,
    lastKnownLocation: scenario.location,
    lastSeenTime: scenario.lastSeenTime,
    observedDirectionDegrees: null,
    possibleDirectionDegrees: null,
    terrain: scenario.terrain,
    shelterContext: "Ойролцоох хороо, хашаа, өвөлжөөний мэдээллийг малчин өөрөө нэмж шалгана.",
    notes: "DEMO тайлан — бодит алга болсон малын мэдээлэл биш.",
  };
}

function WeatherStepCard({ step, active, onSelect }: {
  readonly step: HerderWeatherStep;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const direction = WIND_DIRECTION_LABELS_MN[cardinalFromDegrees(step.windDirectionDegrees)];
  return (
    <button
      type="button"
      className="weather-step-card"
      data-active={active}
      onClick={onSelect}
      aria-pressed={active}
    >
      <time dateTime={step.validTime}>{formatDateTime(step.validTime)}</time>
      <strong>{step.temperatureC.toFixed(0)}°</strong>
      <span className="weather-step-card__wind">
        <i style={{ transform: `rotate(${step.windDirectionDegrees + 180}deg)` }} aria-hidden="true">↑</i>
        {step.windSpeedMps.toFixed(1)} м/с · {direction}
      </span>
      <span>{step.precipitationMm.toFixed(1)} мм / 6ц</span>
      {step.visibilityConcern !== "none" ? (
        <em>{step.visibilityConcern === "snow" ? "Цасан шуурганы нөхцөл" : step.visibilityConcern === "dust" ? "Шороон тоосны нөхцөл" : "Их борооны нөхцөл"}</em>
      ) : null}
    </button>
  );
}

export function HerderMode() {
  const [scenarioId, setScenarioId] = useState(HERDER_DEMO_SCENARIOS[0]!.id);
  const scenario = getDemoScenario(scenarioId);
  const [report, setReport] = useState<MissingLivestockReport>(() => reportForScenario(scenario));
  const [period, setPeriod] = useState<WeatherPeriod>("historical");
  const [activeTimeIndex, setActiveTimeIndex] = useState(0);
  const [distanceMultiplier, setDistanceMultiplier] = useState(1);
  const [bearingShiftDegrees, setBearingShiftDegrees] = useState(0);
  const liteMode = useSyncExternalStore(subscribeToLiteMode, getLiteMode, () => true);
  const [saveMessage, setSaveMessage] = useState("");

  const periods = useMemo(() => splitWeatherPeriods(scenario.weather), [scenario]);
  const visibleWeather = period === "historical" ? periods.historical : periods.forecast;
  const activeWeather = visibleWeather[activeTimeIndex] ?? visibleWeather[0] ?? null;
  const analysis = useMemo(
    () => analyzeHistoricalWeather(scenario.weather, report.lastSeenTime),
    [report.lastSeenTime, scenario.weather],
  );
  const searchAreas = useMemo(
    () =>
      buildSearchAreas(report, analysis, {
        distanceMultiplier,
        bearingShiftDegrees,
      }),
    [analysis, bearingShiftDegrees, distanceMultiplier, report],
  );
  const risks = useMemo(() => assessWeatherRisks(activeWeather), [activeWeather]);
  const species = SPECIES_CONFIG[report.species];

  const updateReport = useCallback(
    <Key extends keyof MissingLivestockReport>(
      key: Key,
      value: MissingLivestockReport[Key],
    ) => setReport((current) => ({ ...current, [key]: value })),
    [],
  );

  const chooseScenario = (id: string) => {
    const nextScenario = getDemoScenario(id);
    setScenarioId(id);
    setReport(reportForScenario(nextScenario));
    setPeriod("historical");
    setActiveTimeIndex(0);
    setDistanceMultiplier(1);
    setBearingShiftDegrees(0);
    setSaveMessage("");
  };

  const choosePeriod = (nextPeriod: WeatherPeriod) => {
    setPeriod(nextPeriod);
    setActiveTimeIndex(0);
  };

  const savePrivateReport = () => {
    window.localStorage.setItem(LOCAL_REPORT_KEY, JSON.stringify(report));
    setSaveMessage("Энэ төхөөрөмжийн browser-д хадгаллаа. Сервер рүү илгээгээгүй.");
  };

  const loadPrivateReport = () => {
    const stored = window.localStorage.getItem(LOCAL_REPORT_KEY);
    if (!stored) {
      setSaveMessage("Энэ төхөөрөмж дээр хадгалсан тайлан олдсонгүй.");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<MissingLivestockReport>;
      if (
        typeof parsed.species !== "string" ||
        typeof parsed.count !== "number" ||
        typeof parsed.lastSeenTime !== "string"
      ) {
        throw new Error("invalid");
      }
      setReport((current) => ({ ...current, ...parsed }));
      setSaveMessage("Хадгалсан тайланг энэ төхөөрөмжөөс нээлээ.");
    } catch {
      setSaveMessage("Хадгалсан тайлангийн бүтэц буруу тул нээсэнгүй.");
    }
  };

  return (
    <div className="herder-app" id="top">
      <a className="skip-link" href="#herder-main">Үндсэн агуулга руу очих</a>
      <header className="herder-header">
        <Link className="herder-brand" href="/" aria-label="Tsag-uur цаг агаарын зураг руу буцах">
          <span className="herder-brand__mark"><BrandMark /></span>
          <span><strong>Tsag-uur</strong><small>Малчин горим</small></span>
        </Link>
        <nav aria-label="Үндсэн цэс">
          <Link href="/">Цаг агаар</Link>
          <Link href="/herder" aria-current="page">Малчин</Link>
          <Link href="/dashboard">Текстэн самбар</Link>
        </nav>
        <button
          type="button"
          className="lite-toggle"
          aria-pressed={liteMode}
          onClick={() => {
            const next = !liteMode;
            window.localStorage.setItem(LITE_MODE_KEY, String(next));
            window.dispatchEvent(new Event(LITE_MODE_EVENT));
          }}
        >
          {liteMode ? "Lite: асаалттай" : "Lite горим"}
        </button>
      </header>

      <div className="herder-demo-banner" role="note">
        <strong>DEMO · ЗОХИОМОЛ ӨГӨГДӨЛ</strong>
        <span>Бодит ажиглалт, төлөв, албан сэрэмжлүүлэг, GPS мөр биш. Бодит шийдвэрт ашиглахгүй.</span>
      </div>

      <main id="herder-main" className="herder-main">
        <section className="herder-hero" aria-labelledby="herder-title">
          <div>
            <p className="herder-eyebrow">Малчинд зориулсан цаг агаарын туслах</p>
            <h1 id="herder-title">Алга болсон мал хайхад туслах</h1>
            <p>
              Сүүлд харагдсан газар, малчны ажиглалт, өнгөрсөн цаг агаарын DEMO мэдээллийг нийлүүлж хайж шалгах хувилбарууд гаргана. Яг байршил таахгүй.
            </p>
          </div>
          <aside>
            <strong>Аюулгүй байдлыг түрүүнд</strong>
            <p>Албан мэдээ, нутгийн малчид, онцгой байдлын зөвлөгөөг шалгана уу. Эндхийн шулуун чиглэл нь явах зам биш.</p>
          </aside>
        </section>

        <section className="scenario-picker" aria-labelledby="scenario-heading">
          <div>
            <p className="herder-eyebrow">Сургалтын хувилбар</p>
            <h2 id="scenario-heading">DEMO нөхцөл сонгох</h2>
          </div>
          <div className="scenario-picker__options">
            {HERDER_DEMO_SCENARIOS.map((item) => (
              <button
                type="button"
                key={item.id}
                data-active={item.id === scenario.id}
                aria-pressed={item.id === scenario.id}
                onClick={() => chooseScenario(item.id)}
              >
                <strong>{item.nameMn}</strong>
                <span>{item.summaryMn}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="herder-workspace">
          <section className="report-panel" aria-labelledby="report-heading">
            <div className="panel-heading">
              <span className="panel-step">1</span>
              <div><p className="herder-eyebrow">Хувийн тайлан</p><h2 id="report-heading">Алга болсон малын мэдээлэл</h2></div>
            </div>
            <p className="privacy-note">🔒 Тайлан зөвхөн энэ төхөөрөмжийн browser-д хадгалагдана. Analytics, сервер, нийтэд хуваалцах холболт байхгүй.</p>
            <form className="herder-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Малын төрөл</span>
                <select value={report.species} onChange={(event) => updateReport("species", event.target.value as AnimalSpecies)}>
                  {Object.values(SPECIES_CONFIG).map((item) => <option key={item.species} value={item.species}>{item.labelMn}</option>)}
                </select>
              </label>
              <label>
                <span>Ойролцоогоор хэд</span>
                <input type="number" min="1" max="10000" value={report.count} onChange={(event) => updateReport("count", Math.max(1, Number(event.target.value) || 1))} />
              </label>
              <label className="field-wide">
                <span>Сүүлд харсан огноо, цаг · Улаанбаатарын цаг</span>
                <input type="datetime-local" value={toLocalInputValue(report.lastSeenTime)} onChange={(event) => updateReport("lastSeenTime", fromLocalInputValue(event.target.value))} />
              </label>
              <fieldset className="field-wide coordinate-fieldset">
                <legend>Сүүлд харагдсан газар</legend>
                <label><span>Өргөрөг</span><input type="number" step="0.001" min="41.3" max="52.2" value={report.lastKnownLocation?.latitude ?? ""} onChange={(event) => updateReport("lastKnownLocation", { latitude: Number(event.target.value), longitude: report.lastKnownLocation?.longitude ?? 103.8 })} /></label>
                <label><span>Уртраг</span><input type="number" step="0.001" min="87.5" max="120" value={report.lastKnownLocation?.longitude ?? ""} onChange={(event) => updateReport("lastKnownLocation", { latitude: report.lastKnownLocation?.latitude ?? 46.8, longitude: Number(event.target.value) })} /></label>
                <small>Доорх зураг дээр дарж мөн сонгож болно.</small>
              </fieldset>
              <label>
                <span>Сүүлд явсан чиглэл (°)</span>
                <input type="number" min="0" max="359" placeholder="Мэдэхгүй бол хоосон" value={report.observedDirectionDegrees ?? ""} onChange={(event) => updateReport("observedDirectionDegrees", event.target.value === "" ? null : Number(event.target.value))} />
              </label>
              <label>
                <span>Боломжит чиглэл (°)</span>
                <input type="number" min="0" max="359" placeholder="Малчны таамаг" value={report.possibleDirectionDegrees ?? ""} onChange={(event) => updateReport("possibleDirectionDegrees", event.target.value === "" ? null : Number(event.target.value))} />
              </label>
              <label className="field-wide">
                <span>Газрын нөхцөл</span>
                <select value={report.terrain} onChange={(event) => updateReport("terrain", event.target.value as TerrainContext)}>
                  {Object.entries(TERRAIN_LABELS_MN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="field-wide">
                <span>Маллагаа, хоргодох нөхцөл</span>
                <textarea rows={3} value={report.shelterContext} onChange={(event) => updateReport("shelterContext", event.target.value)} placeholder="Өвөлжөө, хашаа, хот айл, бэлчээрийн ажиглалт…" />
              </label>
              <label className="field-wide">
                <span>Малчны нэмэлт тэмдэглэл</span>
                <textarea rows={3} value={report.notes} onChange={(event) => updateReport("notes", event.target.value)} />
              </label>
              <div className="form-actions field-wide">
                <button type="button" className="button-primary" onClick={savePrivateReport}>Энэ төхөөрөмжид хадгалах</button>
                <button type="button" className="button-secondary" onClick={loadPrivateReport}>Хадгалсан тайлан нээх</button>
              </div>
              {saveMessage ? <p className="form-message field-wide" role="status">{saveMessage}</p> : null}
            </form>
          </section>

          <section className="weather-panel" aria-labelledby="weather-heading">
            <div className="panel-heading">
              <span className="panel-step">2</span>
              <div><p className="herder-eyebrow">7 + 7 хоног</p><h2 id="weather-heading">Цаг агаарын түүх ба төлөв</h2></div>
            </div>
            <div className="period-tabs" role="tablist" aria-label="Цагийн төрөл">
              <button type="button" role="tab" aria-selected={period === "historical"} onClick={() => choosePeriod("historical")}>
                <strong>Өнгөрсөн 7 хоног</strong><span>DEMO түүх · 6 цагийн алхам</span>
              </button>
              <button type="button" role="tab" aria-selected={period === "forecast"} onClick={() => choosePeriod("forecast")}>
                <strong>Ирэх 7 хоног</strong><span>DEMO төлөв · 6 цагийн алхам</span>
              </button>
            </div>
            <div className="period-status" data-period={period}>
              <strong>{period === "historical" ? "ТҮҮХЭН DEMO" : "УРЬДЧИЛСАН DEMO"}</strong>
              <span>{period === "historical" ? "Өнгөрсөн нөхцөл — ирээдүйн төлөвтэй хольж харуулаагүй" : "Ирээдүйн нөхцөл — албан прогноз биш"}</span>
            </div>
            <div className="weather-timeline" aria-label={`${period === "historical" ? "Өнгөрсөн" : "Ирэх"} долоон хоногийн цаг агаар`}>
              {visibleWeather.map((step, index) => (
                <WeatherStepCard key={step.id} step={step} active={index === activeTimeIndex} onSelect={() => setActiveTimeIndex(index)} />
              ))}
            </div>
            <label className="time-slider">
              <span>Цагийн алхам: {activeWeather ? formatDateTime(activeWeather.validTime) : "Өгөгдөлгүй"}</span>
              <input type="range" min="0" max={Math.max(0, visibleWeather.length - 1)} value={Math.min(activeTimeIndex, Math.max(0, visibleWeather.length - 1))} onChange={(event) => setActiveTimeIndex(Number(event.target.value))} />
            </label>
            <dl className="weather-metadata">
              <div><dt>Өгөгдлийн эх сурвалж</dt><dd>{HERDER_DEMO_METADATA.sourceMn}</dd></div>
              <div><dt>Загвар / статус</dt><dd>{HERDER_DEMO_METADATA.modelMn}</dd></div>
              <div><dt>Үүсгэсэн цаг</dt><dd>{formatDateTime(HERDER_DEMO_METADATA.generatedAt)}</dd></div>
              <div><dt>Нарийвчлал</dt><dd>{HERDER_DEMO_METADATA.nominalResolutionMn}</dd></div>
            </dl>
          </section>
        </div>

        <section className="analysis-panel" aria-labelledby="analysis-heading">
          <div className="panel-heading"><span className="panel-step">3</span><div><p className="herder-eyebrow">U/V салхины шинжилгээ</p><h2 id="analysis-heading">Сүүлд харснаас хойших нөхцөл</h2></div></div>
          <div className="analysis-grid">
            <div><span>Шинжилсэн алхам</span><strong>{analysis.stepsConsidered}</strong><small>түүхэн DEMO алхам</small></div>
            <div><span>Хамгийн хүчтэй салхи</span><strong>{analysis.strongestWindMps === null ? "—" : `${analysis.strongestWindMps.toFixed(1)} м/с`}</strong><small>{formatDateTime(analysis.strongestWindTime)}</small></div>
            <div><span>Нийт тунадас</span><strong>{analysis.totalPrecipitationMm === null ? "—" : `${analysis.totalPrecipitationMm.toFixed(1)} мм`}</strong><small>6 цагийн DEMO утгуудын нийлбэр</small></div>
            <div><span>Дундаж салхины урсгал</span><strong>{analysis.meanWindFlowDirectionDegrees === null ? "—" : `${Math.round(analysis.meanWindFlowDirectionDegrees)}° руу`}</strong><small>U/V векторын нийлбэр; малын чиглэл биш</small></div>
          </div>
          <div className="analysis-notes">
            <div><h3>Нөлөөлж болох нөхцөл</h3>{analysis.eventNotesMn.length ? <ul>{analysis.eventNotesMn.map((note) => <li key={note}>{note}</li>)}</ul> : <p>Тусгай DEMO нөхцөл илрээгүй.</p>}</div>
            <div><h3>Дутуу мэдээлэл</h3><ul>{[...analysis.missingInputsMn, "Цасны зузаан ба мөстөлт", "Газрын өндөршил, гол ус, ургамалжилт", "Бодит ажиглалт ба малын GPS мөр"].map((note) => <li key={note}>{note}</li>)}</ul></div>
          </div>
        </section>

        <section className="search-panel" aria-labelledby="search-heading">
          <div className="panel-heading"><span className="panel-step">4</span><div><p className="herder-eyebrow">Төлөвлөлтийн зураг</p><h2 id="search-heading">Туршилтын хайлтын бүс — баталгаажаагүй</h2></div></div>
          <p className="search-disclaimer">Эдгээр өнгөт бүс нь гараар шалгах ажлыг эрэмбэлэх жишиг. Мал энд байгаа гэсэн магадлал, бодит мөр, эсвэл аюулгүй маршрут биш.</p>
          <div className="search-controls">
            <label><span>Бүсийн хэмжээг засах · {distanceMultiplier.toFixed(1)}×</span><input type="range" min="0.4" max="1.8" step="0.1" value={distanceMultiplier} onChange={(event) => setDistanceMultiplier(Number(event.target.value))} /></label>
            <label><span>Чиглэлийг засах · {bearingShiftDegrees > 0 ? "+" : ""}{bearingShiftDegrees}°</span><input type="range" min="-90" max="90" step="5" value={bearingShiftDegrees} onChange={(event) => setBearingShiftDegrees(Number(event.target.value))} /></label>
          </div>
          <div className="search-layout">
            <div className="search-map-column">
              {!liteMode ? (
                <DynamicHerderMap
                  location={report.lastKnownLocation}
                  searchAreas={searchAreas}
                  weatherStep={activeWeather}
                  speciesLabel={species.labelMn}
                  onSelectLocation={(lastKnownLocation) => updateReport("lastKnownLocation", lastKnownLocation)}
                />
              ) : (
                <div className="lite-map-fallback">
                  <strong>Lite горим · газрын зураг ачаалаагүй</strong>
                  <p>Суурь зураг, MapLibre JavaScript, tile хүсэлт үүсгэхгүй. Доорх координат ба бүсийн тайлбарыг ашиглана.</p>
                  <dl><div><dt>Өргөрөг</dt><dd>{report.lastKnownLocation?.latitude.toFixed(3) ?? "—"}</dd></div><div><dt>Уртраг</dt><dd>{report.lastKnownLocation?.longitude.toFixed(3) ?? "—"}</dd></div></dl>
                </div>
              )}
              <div className="map-legend" aria-label="Газрын зургийн тайлбар">
                <strong>Тайлбар</strong>
                <span><i className="legend-marker" /> Сүүлд харагдсан газар</span>
                {searchAreas.map((area) => <span key={area.id}><i style={{ background: area.color }} /> {area.titleMn}</span>)}
                <span><i className="legend-arrow">↑</i> Сонгосон цагийн салхины урсгал</span>
              </div>
            </div>
            <div className="search-area-list">
              {searchAreas.map((area, index) => (
                <article key={area.id} style={{ borderLeftColor: area.color }}>
                  <div><span>{index + 1}</span><h3>{area.titleMn}</h3></div>
                  <p className="area-measure">{Math.round(area.bearingDegrees)}° чиглэл · {area.distanceKm.toFixed(1)} км хүртэлх дүрслэлийн хүрээ</p>
                  <h4>Яагаад санал болгосон</h4><ul>{area.reasonsMn.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <details><summary>Хязгаарлалтыг харах</summary><ul>{area.limitationsMn.map((limit) => <li key={limit}>{limit}</li>)}</ul></details>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="risk-panel" aria-labelledby="risk-heading">
          <div className="panel-heading"><span className="panel-step">5</span><div><p className="herder-eyebrow">Хайлт хийх үеийн нөхцөл</p><h2 id="risk-heading">Мал ба малчны цаг агаарын анхаарах зүйл</h2></div></div>
          <p className="threshold-note">Ангилал нь бүтээгдэхүүн турших жишиг босго ашигласан; албан анхааруулга эсвэл баталгаажсан малын аюулгүй байдлын босго биш. Түүхий хэмжилтийг хамт харуулав.</p>
          <div className="risk-grid">
            {risks.map((risk) => <article key={risk.id} data-level={risk.level}><span className="risk-level">{risk.level === "high" ? "ӨНДӨР DEMO" : risk.level === "watch" ? "АНХААРАХ DEMO" : risk.level === "unavailable" ? "ӨГӨГДӨЛГҮЙ" : "МЭДЭЭЛЭЛ"}</span><h3>{risk.labelMn}</h3><strong>{risk.rawValueMn}</strong><p>{risk.explanationMn}</p></article>)}
          </div>
        </section>

        <section className="trust-panel" aria-labelledby="trust-heading">
          <div><p className="herder-eyebrow">Өгөгдлийн ил тод байдал</p><h2 id="trust-heading">Юуг мэдэж, юуг мэдэхгүй вэ?</h2></div>
          <div className="trust-grid">
            <article><h3>Одоо байгаа</h3><ul><li>Дахин үүсгэхэд ижил гарах 3 DEMO хувилбар</li><li>6 цагийн U/V салхи, температур, тунадас</li><li>Малчны оруулсан чиглэл, газрын төрөл, тэмдэглэл</li></ul></article>
            <article><h3>Холбогдоогүй</h3><ul><li>WRF/NetCDF ба станцын бодит түүх</li><li>Албан сэрэмжлүүлэг, харагдац, тоосонцор</li><li>DEM өндөршил, ус, зам, цас, ургамалжилт</li><li>Малын GPS ба баталгаажуулсан хөдөлгөөний загвар</li></ul></article>
            <article><h3>Ашиглах зарчим</h3><ul><li>Салхийг дангаар нь малын чиглэл гэж үзэхгүй</li><li>Малчны нутгийн мэдлэгийг эхний оролт болгоно</li><li>Зөвхөн хайж шалгах хувилбар, баталгаа биш</li></ul></article>
          </div>
          <p className="trust-warning">Аюултай нөхцөлд албан сэрэмжлүүлэг шалгаж, нутгийн малчид болон шаардлагатай бол онцгой байдлын байгууллагатай зөвлөнө үү. Энэ систем хайлтын зам аюулгүй гэж батлахгүй.</p>
        </section>
      </main>

      <footer className="herder-footer">
        <span>Tsag-uur · Малчин горимын DEMO</span>
        <Link href="/">Иргэний цаг агаарын зураг</Link>
        <a href="#top">Дээш очих</a>
      </footer>
    </div>
  );
}
