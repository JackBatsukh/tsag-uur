"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { BrandMark } from "@/components/icons";

import { DynamicLivestockSearchMap } from "./dynamic-livestock-search-map";
import {
  buildLivestockSearchAreas,
  chooseDirection,
  isSevereWeatherCode,
  largestSixHourTemperatureDrop,
  weatherCodeLabelMn,
} from "./forecast-utils";
import type {
  HerderForecastPayload,
  LivestockSearchPayload,
  MissingLivestockDraft,
  PasturePriority,
} from "./types";

const LOCATION_KEY = "tsag-uur-herder-location-v2";
const LIVESTOCK_DRAFT_KEY = "tsag-uur-herder-lost-livestock-v3";

const EMPTY_DRAFT: MissingLivestockDraft = Object.freeze({
  species: "Хонь",
  count: "",
  lastSeenTime: "",
  lastSeenPlace: "",
  directionNote: "",
  lastSeenLatitude: "",
  lastSeenLongitude: "",
  observedDirectionDegrees: "",
  maxSearchKm: "15",
});

function formatTime(
  value: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("mn-MN", { timeZone: timezone, ...options }).format(new Date(value));
}

function windDirectionMn(degrees: number): string {
  const labels = ["Х", "ХЗ", "З", "ӨЗ", "Ө", "ӨБ", "Б", "ХБ"];
  return labels[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]!;
}

function bearingLabelMn(degrees: number): string {
  const labels = ["хойд", "зүүн хойд", "зүүн", "зүүн өмнөд", "өмнөд", "баруун өмнөд", "баруун", "баруун хойд"];
  return labels[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]!;
}

function priorityLabel(priority: PasturePriority): string {
  if (priority === "precipitation") return "тунадас багатай";
  if (priority === "cold") return "дулаан мэдрэгдэх";
  return "салхины ширүүсэлт багатай";
}

function WeatherSymbol({ code }: { readonly code: number }) {
  const label = weatherCodeLabelMn(code);
  const symbol = [95, 96, 97, 99].includes(code)
    ? "ϟ"
    : [71, 73, 75, 77, 85, 86].includes(code)
      ? "✣"
      : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
        ? "☂"
        : [45, 48].includes(code)
          ? "≋"
          : [0, 1].includes(code)
            ? "☀"
            : "☁";
  return <span className="weather-symbol" aria-label={label} role="img">{symbol}</span>;
}

async function requestForecast(latitude: number, longitude: number): Promise<HerderForecastPayload> {
  const response = await fetch(
    `/api/herder-forecast?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
    { cache: "no-store" },
  );
  const body = await response.json() as HerderForecastPayload | { readonly error?: string };
  if (!response.ok || !("current" in body)) {
    throw new Error("error" in body && body.error ? body.error : "Мэдээлэл татаж чадсангүй.");
  }
  return body;
}

async function requestLivestockSearch(
  latitude: number,
  longitude: number,
  lastSeenTime: string,
): Promise<LivestockSearchPayload> {
  const response = await fetch(
    `/api/livestock-search?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&lastSeen=${encodeURIComponent(lastSeenTime)}`,
    { cache: "no-store" },
  );
  const body = await response.json() as LivestockSearchPayload | { readonly error?: string };
  if (!response.ok || !("analysis" in body)) {
    throw new Error("error" in body && body.error ? body.error : "Өнгөрсөн цаг агаарын мэдээлэл татаж чадсангүй.");
  }
  return body;
}

export function HerderMode() {
  const [forecast, setForecast] = useState<HerderForecastPayload | null>(null);
  const [priority, setPriority] = useState<PasturePriority>("wind");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [draft, setDraft] = useState<MissingLivestockDraft>(EMPTY_DRAFT);
  const [draftMessage, setDraftMessage] = useState("");
  const [searchResult, setSearchResult] = useState<LivestockSearchPayload | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const bestDirection = useMemo(
    () => chooseDirection(forecast?.directions ?? [], priority),
    [forecast, priority],
  );
  const searchAreas = useMemo(() => {
    if (!searchResult) return [];
    const observed = draft.observedDirectionDegrees.trim() === ""
      ? null
      : Number(draft.observedDirectionDegrees);
    return buildLivestockSearchAreas(
      searchResult.location,
      searchResult.analysis,
      Number(draft.maxSearchKm),
      Number.isFinite(observed) ? observed : null,
    );
  }, [draft.maxSearchKm, draft.observedDirectionDegrees, searchResult]);
  const next24Hours = forecast?.hourly.slice(0, 24) ?? [];
  const severeHour = next24Hours.find((hour) => isSevereWeatherCode(hour.weatherCode)) ?? null;
  const temperatureDrop = largestSixHourTemperatureDrop(next24Hours);
  const maxGustHour = next24Hours.length
    ? [...next24Hours].sort((left, right) => right.windGustMps - left.windGustMps)[0]!
    : null;
  const precipitationHour = next24Hours.length
    ? [...next24Hours].sort((left, right) => right.precipitationProbabilityPercent - left.precipitationProbabilityPercent)[0]!
    : null;

  const loadForecast = useCallback(async (nextLatitude: number, nextLongitude: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await requestForecast(nextLatitude, nextLongitude);
      setForecast(result);
      setLatitude(nextLatitude.toFixed(5));
      setLongitude(nextLongitude.toFixed(5));
      window.localStorage.setItem(LOCATION_KEY, JSON.stringify({ latitude: nextLatitude, longitude: nextLongitude }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Цаг агаарын мэдээлэл татаж чадсангүй.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const storedLocation = JSON.parse(window.localStorage.getItem(LOCATION_KEY) ?? "null") as {
          latitude?: unknown;
          longitude?: unknown;
        } | null;
        if (typeof storedLocation?.latitude === "number" && typeof storedLocation.longitude === "number") {
          void loadForecast(storedLocation.latitude, storedLocation.longitude);
        }

        const storedDraft = JSON.parse(window.localStorage.getItem(LIVESTOCK_DRAFT_KEY) ?? "null") as Partial<MissingLivestockDraft> | null;
        if (storedDraft) setDraft({ ...EMPTY_DRAFT, ...storedDraft });
      } catch {
        // Corrupt browser-local state is ignored and replaced on the next save.
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [loadForecast]);

  const useCurrentLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Энэ төхөөрөмж байршил тогтоох боломжгүй байна. Координатаа гараар оруулна уу.");
      setManualOpen(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => void loadForecast(position.coords.latitude, position.coords.longitude),
      () => {
        setLoading(false);
        setManualOpen(true);
        setError("Байршлын зөвшөөрөл олгогдсонгүй. Координатаа гараар оруулна уу.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60 * 1000 },
    );
  };

  const submitCoordinates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude) ||
      nextLatitude < -90 || nextLatitude > 90 || nextLongitude < -180 || nextLongitude > 180) {
      setError("Өргөрөг, уртрагийн утгыг шалгана уу.");
      return;
    }
    void loadForecast(nextLatitude, nextLongitude);
  };

  const loadSavedLocation = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LOCATION_KEY) ?? "null") as {
        latitude?: unknown;
        longitude?: unknown;
      } | null;
      if (typeof stored?.latitude !== "number" || typeof stored.longitude !== "number") {
        setError("Энэ төхөөрөмж дээр хадгалсан байршил олдсонгүй.");
        return;
      }
      void loadForecast(stored.latitude, stored.longitude);
    } catch {
      setError("Хадгалсан байршлыг уншиж чадсангүй.");
    }
  };

  const updateDraft = <Key extends keyof MissingLivestockDraft>(
    key: Key,
    value: MissingLivestockDraft[Key],
  ) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    window.localStorage.setItem(LIVESTOCK_DRAFT_KEY, JSON.stringify(next));
    setDraftMessage("Энэ төхөөрөмжид автоматаар хадгалсан");
    setSearchResult(null);
  };

  const copyDeviceLocationToDraft = () => {
    if (!forecast) {
      setSearchError("Эхлээд төхөөрөмжийн байршлаа сонгоно уу.");
      return;
    }
    const next = {
      ...draft,
      lastSeenLatitude: forecast.location.latitude.toFixed(5),
      lastSeenLongitude: forecast.location.longitude.toFixed(5),
    };
    setDraft(next);
    window.localStorage.setItem(LIVESTOCK_DRAFT_KEY, JSON.stringify(next));
    setDraftMessage("Төхөөрөмжийн байршлыг сүүлд харсан цэгт орууллаа");
    setSearchResult(null);
  };

  const submitLivestockSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lastSeenLatitude = Number(draft.lastSeenLatitude);
    const lastSeenLongitude = Number(draft.lastSeenLongitude);
    const maxSearchKm = Number(draft.maxSearchKm);
    const lastSeenMs = Date.parse(draft.lastSeenTime);
    if (!Number.isFinite(lastSeenLatitude) || !Number.isFinite(lastSeenLongitude) ||
      lastSeenLatitude < -90 || lastSeenLatitude > 90 || lastSeenLongitude < -180 || lastSeenLongitude > 180) {
      setSearchError("Сүүлд харсан газрын өргөрөг, уртрагыг шалгана уу.");
      return;
    }
    if (!Number.isFinite(lastSeenMs)) {
      setSearchError("Сүүлд харсан огноо, цагийг оруулна уу.");
      return;
    }
    if (!Number.isFinite(maxSearchKm) || maxSearchKm < 1 || maxSearchKm > 100) {
      setSearchError("Хайх дээд хүрээг 1–100 км-ийн хооронд оруулна уу.");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    window.localStorage.setItem(LIVESTOCK_DRAFT_KEY, JSON.stringify(draft));
    try {
      const result = await requestLivestockSearch(
        lastSeenLatitude,
        lastSeenLongitude,
        new Date(lastSeenMs).toISOString(),
      );
      setSearchResult(result);
      setDraftMessage("Тэмдэглэл ба сүүлд харсан цэг энэ төхөөрөмжид хадгалагдсан");
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "Хайлтын мэдээлэл гаргаж чадсангүй.");
    } finally {
      setSearchLoading(false);
    }
  };

  const selectLastSeenOnMap = (coordinates: { latitude: number; longitude: number }) => {
    const next = {
      ...draft,
      lastSeenLatitude: coordinates.latitude.toFixed(5),
      lastSeenLongitude: coordinates.longitude.toFixed(5),
    };
    setDraft(next);
    window.localStorage.setItem(LIVESTOCK_DRAFT_KEY, JSON.stringify(next));
    setDraftMessage("Цэгийг шинэчиллээ — шинэ мэдээллээр дахин тооцоолно уу");
    setSearchResult(null);
  };

  return (
    <div className="herder-app" id="top">
      <a className="skip-link" href="#herder-main">Үндсэн хэсэг рүү очих</a>
      <header className="herder-header">
        <Link className="herder-brand" href="/" aria-label="Tsag-uur нүүр хуудас">
          <span className="herder-brand__mark"><BrandMark /></span>
          <span><strong>Tsag-uur</strong><small>Малчин</small></span>
        </Link>
        <nav aria-label="Малчин горимын цэс">
          <a href="#today">Өнөөдөр</a>
          <a href="#pasture">Бэлчээр</a>
          <a href="#livestock">Мал хайх</a>
          <a href="#outlook">36 цаг</a>
        </nav>
        <Link className="back-to-map" href="/">Ерөнхий зураг</Link>
      </header>

      <main id="herder-main" className="herder-main">
        <section className="herder-intro" id="today">
          <div>
            <p className="herder-kicker">Өнөөдрийн ажилд</p>
            <h1>Хаашаа бэлчээх вэ?</h1>
            <p>Энэ төхөөрөмжийн байршлыг хадгалж, бодит урьдчилсан төлөвийг 4 зүгт харьцуулна.</p>
          </div>
          <div className="location-actions">
            <button className="primary-action" type="button" onClick={useCurrentLocation} disabled={loading}>
              <span aria-hidden="true">⌖</span>{loading ? "Татаж байна…" : "Миний байршил"}
            </button>
            <button className="quiet-action" type="button" onClick={() => setManualOpen((value) => !value)}>
              Координат оруулах
            </button>
            <button className="text-action" type="button" onClick={loadSavedLocation}>Хадгалсан байршил</button>
          </div>
        </section>

        {manualOpen ? (
          <form className="coordinate-form" onSubmit={submitCoordinates}>
            <label><span>Өргөрөг</span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="47.9184" required /></label>
            <label><span>Уртраг</span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="106.9177" required /></label>
            <button type="submit" disabled={loading}>Төлөв харах</button>
          </form>
        ) : null}
        {forecast ? <p className="device-location-saved"><span aria-hidden="true">✓</span> Энэ утас/PC дээр хадгалсан · дараагийн нээлтээр автоматаар ашиглана</p> : null}
        {error ? <div className="herder-error" role="alert">{error}</div> : null}

        {!forecast ? (
          <section className="empty-weather" aria-live="polite">
            <div className="empty-weather__visual" aria-hidden="true"><span>⌖</span><i /></div>
            <div>
              <p className="herder-kicker">Зохиомол тоо харуулахгүй</p>
              <h2>Байршлаа нэг удаа өгнө</h2>
              <p>Утас эсвэл PC бүр байршлаа тусдаа хадгалж, дараагийн нээлтээр тухайн газрын мэдээллийг автоматаар харуулна.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="current-grid" aria-labelledby="current-heading">
              <article className="current-card">
                <div className="card-topline">
                  <div><span className="live-dot">Шинэ төлөв</span><h2 id="current-heading">Одоо</h2></div>
                  <WeatherSymbol code={forecast.current.weatherCode} />
                </div>
                <div className="temperature-row">
                  <strong>{Math.round(forecast.current.temperatureC)}°</strong>
                  <div><b>{weatherCodeLabelMn(forecast.current.weatherCode)}</b><span>Мэдрэгдэх {Math.round(forecast.current.apparentTemperatureC)}°</span></div>
                </div>
                <div className="current-metrics">
                  <div><span>Салхи</span><strong>{forecast.current.windSpeedMps.toFixed(1)} м/с</strong><small>{windDirectionMn(forecast.current.windDirectionDegrees)} зүгээс</small></div>
                  <div><span>Ширүүсэлт</span><strong>{forecast.current.windGustMps.toFixed(1)} м/с</strong><small>10 м өндөрт</small></div>
                  <div><span>Тунадас</span><strong>{forecast.current.precipitationMm.toFixed(1)} мм</strong><small>Сүүлийн цаг</small></div>
                </div>
              </article>

              <article className={`alert-card ${severeHour ? "alert-card--warning" : ""}`}>
                <div className="card-topline">
                  <div><span className="section-label">Дараагийн 24 цаг</span><h2>Гэнэтийн өөрчлөлт</h2></div>
                  <span className="alert-icon" aria-hidden="true">!</span>
                </div>
                {severeHour ? (
                  <div className="alert-lead">
                    <strong>{weatherCodeLabelMn(severeHour.weatherCode)} төлөвтэй</strong>
                    <time dateTime={severeHour.time}>{formatTime(severeHour.time, forecast.timezone, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                ) : (
                  <div className="alert-lead alert-lead--calm"><strong>Хүчтэй үзэгдлийн код илрээгүй</strong><span>WMO кодын 24 цагийн төлөв</span></div>
                )}
                <div className="change-metrics">
                  <div><span>6 цагийн хүйтрэлт</span><strong>{temperatureDrop ? `−${temperatureDrop.amountC.toFixed(1)}°` : "—"}</strong></div>
                  <div><span>Их ширүүсэлт</span><strong>{maxGustHour ? `${maxGustHour.windGustMps.toFixed(1)} м/с` : "—"}</strong></div>
                  <div><span>Тунадасны оргил</span><strong>{precipitationHour ? `${Math.round(precipitationHour.precipitationProbabilityPercent)}%` : "—"}</strong></div>
                </div>
                <p className="official-note"><span aria-hidden="true">i</span> Албан сэрэмжлүүлэг холбогдоогүй. Онцгой нөхцөлд ЦУОШГ, ОБЕГ-ын мэдээг давхар шалгана уу.</p>
              </article>
            </section>

            <section className="pasture-section" id="pasture" aria-labelledby="pasture-heading">
              <div className="section-heading">
                <div><p className="herder-kicker">12 км · дараагийн 12 цаг</p><h2 id="pasture-heading">Бэлчээрийн зүг харьцуулах</h2></div>
                <fieldset className="priority-switch">
                  <legend>Юуг түрүүнд харах вэ?</legend>
                  {([['wind', 'Салхи'], ['precipitation', 'Тунадас'], ['cold', 'Хүйтэн']] as const).map(([value, label]) => (
                    <label key={value}><input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} /><span>{label}</span></label>
                  ))}
                </fieldset>
              </div>
              {bestDirection ? (
                <div className="direction-answer">
                  <span className="direction-arrow" style={{ transform: `rotate(${bestDirection.bearingDegrees}deg)` }} aria-hidden="true">↑</span>
                  <div><span>Цаг агаарын хувьд эхэлж шалгах</span><strong>{bestDirection.labelMn} зүг</strong><small>{priorityLabel(priority)} үзүүлэлттэй</small></div>
                  <p>Өвс, ус, цас, замын нөхцөлийг нутгийн мэдлэгээр заавал нягтал.</p>
                </div>
              ) : null}
              <div className="direction-grid">
                {forecast.directions.map((direction) => (
                  <article key={direction.id} className={bestDirection?.id === direction.id ? "direction-card direction-card--best" : "direction-card"}>
                    <div className="direction-card__title">
                      <span style={{ transform: `rotate(${direction.bearingDegrees}deg)` }} aria-hidden="true">↑</span>
                      <div><strong>{direction.labelMn}</strong><small>{direction.distanceKm} км</small></div>
                      {bestDirection?.id === direction.id ? <b>Эхэлж шалгах</b> : null}
                    </div>
                    <dl>
                      <div><dt>Ширүүсэлт</dt><dd>{direction.maxWindGustMps.toFixed(1)} м/с</dd></div>
                      <div><dt>Тунадас</dt><dd>{direction.precipitationTotalMm.toFixed(1)} мм</dd></div>
                      <div><dt>Мэдрэгдэх доод</dt><dd>{Math.round(direction.minApparentTemperatureC)}°</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="livestock-search" id="livestock" aria-labelledby="livestock-heading">
          <div className="livestock-search__heading">
            <span className="tool-icon" aria-hidden="true">⌕</span>
            <div>
              <p className="herder-kicker">Өнгөрсөн 7 хоногийн цаг агаар</p>
              <h2 id="livestock-heading">Алга болсон малын боломжит бүс</h2>
              <p>Сүүлд харсан цэгээс хойших салхи, цас, бороог нэгтгэж хаанаас эхэлж шалгахыг харуулна.</p>
            </div>
          </div>

          <form className="livestock-search-form" onSubmit={submitLivestockSearch}>
            <label><span>Мал</span><select value={draft.species} onChange={(event) => updateDraft("species", event.target.value)}><option>Хонь</option><option>Ямаа</option><option>Адуу</option><option>Үхэр</option><option>Сарлаг</option><option>Тэмээ</option></select></label>
            <label><span>Тоо</span><input type="number" min="1" inputMode="numeric" value={draft.count} onChange={(event) => updateDraft("count", event.target.value)} placeholder="34" /></label>
            <label><span>Сүүлд харсан цаг</span><input type="datetime-local" value={draft.lastSeenTime} onChange={(event) => updateDraft("lastSeenTime", event.target.value)} required /></label>
            <label><span>Газар нутгийн нэр</span><input value={draft.lastSeenPlace} onChange={(event) => updateDraft("lastSeenPlace", event.target.value)} placeholder="Худаг, өвөлжөө, уул…" /></label>
            <fieldset className="last-seen-coordinates">
              <legend>Сүүлд харсан цэг</legend>
              <label><span>Өргөрөг</span><input inputMode="decimal" value={draft.lastSeenLatitude} onChange={(event) => updateDraft("lastSeenLatitude", event.target.value)} placeholder="47.9184" required /></label>
              <label><span>Уртраг</span><input inputMode="decimal" value={draft.lastSeenLongitude} onChange={(event) => updateDraft("lastSeenLongitude", event.target.value)} placeholder="106.9177" required /></label>
              <button type="button" onClick={copyDeviceLocationToDraft}>Хадгалсан байршлаас авах</button>
            </fieldset>
            <label><span>Сүүлд явсан зүг (°)</span><input type="number" min="0" max="359" inputMode="numeric" value={draft.observedDirectionDegrees} onChange={(event) => updateDraft("observedDirectionDegrees", event.target.value)} placeholder="Мэдэхгүй бол хоосон" /></label>
            <label><span>Хайх дээд хүрээ (км)</span><input type="number" min="1" max="100" inputMode="decimal" value={draft.maxSearchKm} onChange={(event) => updateDraft("maxSearchKm", event.target.value)} required /></label>
            <label className="wide-field"><span>Таних шинж, хашаа, жалга, нөмөр</span><textarea rows={3} value={draft.directionNote} onChange={(event) => updateDraft("directionNote", event.target.value)} placeholder="Нутгийн мэдлэгээр шалгах газруудаа бичнэ…" /></label>
            <div className="livestock-search-actions wide-field">
              <button className="search-submit" type="submit" disabled={searchLoading}>{searchLoading ? "Өнгөрсөн цаг агаарыг шинжилж байна…" : "Боломжит бүс гаргах"}</button>
              {draftMessage ? <span role="status">{draftMessage}</span> : null}
            </div>
          </form>
          {searchError ? <div className="herder-error" role="alert">{searchError}</div> : null}

          {searchResult ? (
            <div className="livestock-search-result">
              <article className="search-answer-card">
                <span className="search-answer-card__label">Цаг агаарын нөлөөгөөр</span>
                <div className="search-answer-card__main">
                  <span className="search-result-arrow" style={{ transform: `rotate(${searchResult.analysis.weatherInfluenceBearingDegrees ?? 0}deg)` }} aria-hidden="true">↑</span>
                  <div>
                    <h3>{searchResult.analysis.weatherInfluenceBearingDegrees === null ? "Нэг давамгай чиглэл гараагүй" : `${bearingLabelMn(searchResult.analysis.weatherInfluenceBearingDegrees)} зүгт байх боломжтой`}</h3>
                    <p>{searchResult.analysis.hoursConsidered} цагийн архивлагдсан салхи, цас, бороонд үндэслэв · энэ чиглэлээс эхэлж шалга.</p>
                  </div>
                </div>
                <p className="search-caution">Энэ нь байршлын магадлалын хувь биш. Сүүлд харсан мөр, нутгийн мэдлэг, хашаа-жалга-нөмрийг түрүүлж шалгана.</p>
              </article>

              <div className="search-history-metrics">
                <div><span>Хамгийн их ширүүсэлт</span><strong>{searchResult.analysis.strongestWindMps.toFixed(1)} м/с</strong><small>{formatTime(searchResult.analysis.strongestWindTime, searchResult.timezone, { month: "short", day: "numeric", hour: "2-digit" })}</small></div>
                <div><span>Нийт тунадас</span><strong>{searchResult.analysis.totalPrecipitationMm.toFixed(1)} мм</strong><small>Загварын цагийн нийлбэр</small></div>
                <div><span>Нийт цас</span><strong>{searchResult.analysis.totalSnowfallCm.toFixed(1)} см</strong><small>Загварын цагийн нийлбэр</small></div>
                <div><span>Хамгийн бага харагдац</span><strong>{searchResult.analysis.minimumVisibilityM >= 1000 ? `${(searchResult.analysis.minimumVisibilityM / 1000).toFixed(1)} км` : `${searchResult.analysis.minimumVisibilityM} м`}</strong><small>Цэгэн хэмжилт биш</small></div>
              </div>

              <div className="search-result-layout">
                <div className="search-map-column">
                  <DynamicLivestockSearchMap
                    location={searchResult.location}
                    areas={searchAreas}
                    onSelectLocation={selectLastSeenOnMap}
                  />
                  <div className="search-map-legend">
                    <span><i className="last-seen-dot" /> Сүүлд харсан</span>
                    {searchAreas.map((area) => <span key={area.id}><i style={{ background: area.color }} /> {area.order}. {area.labelMn}</span>)}
                  </div>
                </div>
                <div className="search-area-cards">
                  {searchAreas.map((area) => (
                    <article key={area.id} style={{ borderLeftColor: area.color }}>
                      <div><span>{area.order}</span><h3>{area.labelMn}</h3></div>
                      <strong>{area.bearingDegrees === null ? "Ойрын тойрог" : `${Math.round(area.bearingDegrees)}° · ${bearingLabelMn(area.bearingDegrees)} зүг`} · {area.distanceKm.toFixed(1)} км хүртэл</strong>
                      <p>{area.reasonMn}</p>
                    </article>
                  ))}
                  {draft.directionNote.trim() ? <p className="local-knowledge-note"><strong>Малчны тэмдэглэл</strong>{draft.directionNote}</p> : null}
                </div>
              </div>

              <div className="search-source-note">
                <div><span>Эх сурвалж</span><strong>{searchResult.source.name} · {searchResult.source.model}</strong></div>
                <div><span>Хугацаа</span><strong>{formatTime(searchResult.analysis.startTime, searchResult.timezone, { month: "short", day: "numeric", hour: "2-digit" })} — {formatTime(searchResult.analysis.endTime, searchResult.timezone, { month: "short", day: "numeric", hour: "2-digit" })}</strong></div>
                <details><summary>Хязгаарлалтыг харах</summary><ul>{searchResult.limitationsMn.map((item) => <li key={item}>{item}</li>)}</ul></details>
              </div>
            </div>
          ) : null}
        </section>

        {forecast ? (
          <>
            <section className="outlook-section" id="outlook" aria-labelledby="outlook-heading">
              <div className="section-heading section-heading--simple">
                <div><p className="herder-kicker">3 цагийн алхам</p><h2 id="outlook-heading">36 цагийн төлөв</h2></div>
                <span className="swipe-hint">Хажуу тийш гүйлгэнэ →</span>
              </div>
              <div className="hourly-strip">
                {forecast.hourly.filter((_, index) => index % 3 === 0).map((hour, index) => (
                  <article className="hour-card" key={hour.time}>
                    <time dateTime={hour.time}>{formatTime(hour.time, forecast.timezone, index === 0 ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit" })}</time>
                    <WeatherSymbol code={hour.weatherCode} />
                    <strong>{Math.round(hour.temperatureC)}°</strong>
                    <span>↗ {hour.windSpeedMps.toFixed(1)} м/с</span>
                    <span>☂ {Math.round(hour.precipitationProbabilityPercent)}%</span>
                  </article>
                ))}
              </div>
            </section>
            <section className="source-strip" aria-label="Өгөгдлийн эх сурвалж">
              <div><span className="source-status">● Бодит forecast</span><strong>{forecast.source.name} · {forecast.source.model}</strong></div>
              <div><span>Байршил</span><strong>{forecast.location.latitude.toFixed(4)}, {forecast.location.longitude.toFixed(4)} · {Math.round(forecast.elevationM)} м</strong></div>
              <div><span>Татсан</span><strong>{formatTime(forecast.fetchedAt, forecast.timezone, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></div>
              <details><summary>Хязгаарлалтыг харах</summary><ul>{forecast.limitationsMn.map((item) => <li key={item}>{item}</li>)}</ul></details>
            </section>
          </>
        ) : null}
      </main>

      <nav className="herder-mobile-nav" aria-label="Хурдан цэс">
        <a href="#today"><span aria-hidden="true">☀</span>Өнөөдөр</a>
        <a href="#pasture"><span aria-hidden="true">↑</span>Бэлчээр</a>
        <a href="#livestock"><span aria-hidden="true">⌕</span>Мал хайх</a>
        <a href="#outlook"><span aria-hidden="true">≋</span>Төлөв</a>
      </nav>
    </div>
  );
}
