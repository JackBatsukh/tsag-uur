"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { BrandMark } from "@/components/icons";

import {
  chooseDirection,
  isSevereWeatherCode,
  largestSixHourTemperatureDrop,
  weatherCodeLabelMn,
} from "./forecast-utils";
import type {
  HerderForecastPayload,
  MissingLivestockDraft,
  PasturePriority,
} from "./types";

const LOCATION_KEY = "tsag-uur-herder-location-v2";
const LIVESTOCK_DRAFT_KEY = "tsag-uur-herder-lost-livestock-v2";

const EMPTY_DRAFT: MissingLivestockDraft = Object.freeze({
  species: "Хонь",
  count: "",
  lastSeenTime: "",
  lastSeenPlace: "",
  directionNote: "",
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

  const bestDirection = useMemo(
    () => chooseDirection(forecast?.directions ?? [], priority),
    [forecast, priority],
  );
  const next24Hours = forecast?.hourly.slice(0, 24) ?? [];
  const severeHour = next24Hours.find((hour) => isSevereWeatherCode(hour.weatherCode)) ?? null;
  const temperatureDrop = largestSixHourTemperatureDrop(next24Hours);
  const maxGustHour = next24Hours.length
    ? [...next24Hours].sort((left, right) => right.windGustMps - left.windGustMps)[0]!
    : null;
  const precipitationHour = next24Hours.length
    ? [...next24Hours].sort((left, right) => right.precipitationProbabilityPercent - left.precipitationProbabilityPercent)[0]!
    : null;

  const loadForecast = async (nextLatitude: number, nextLongitude: number) => {
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
  };

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
        setError("Хадгалсан байршил олдсонгүй.");
        return;
      }
      void loadForecast(stored.latitude, stored.longitude);
    } catch {
      setError("Хадгалсан байршлыг уншиж чадсангүй.");
    }
  };

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.localStorage.setItem(LIVESTOCK_DRAFT_KEY, JSON.stringify(draft));
    setDraftMessage("Энэ утсан дээр хадгаллаа.");
  };

  const loadDraft = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LIVESTOCK_DRAFT_KEY) ?? "null") as MissingLivestockDraft | null;
      if (!stored) {
        setDraftMessage("Хадгалсан тэмдэглэл алга.");
        return;
      }
      setDraft(stored);
      setDraftMessage("Хадгалсан тэмдэглэлийг нээлээ.");
    } catch {
      setDraftMessage("Тэмдэглэлийг уншиж чадсангүй.");
    }
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
          <a href="#outlook">36 цаг</a>
          <a href="#livestock">Мал хайх</a>
        </nav>
        <Link className="back-to-map" href="/">Ерөнхий зураг</Link>
      </header>

      <main id="herder-main" className="herder-main">
        <section className="herder-intro" id="today">
          <div>
            <p className="herder-kicker">Өнөөдрийн ажилд</p>
            <h1>Хаашаа бэлчээх вэ?</h1>
            <p>Таны байршлын бодит урьдчилсан төлөвийг 4 зүгт харьцуулна.</p>
          </div>
          <div className="location-actions">
            <button className="primary-action" type="button" onClick={useCurrentLocation} disabled={loading}>
              <span aria-hidden="true">⌖</span>{loading ? "Татаж байна…" : "Миний байршил"}
            </button>
            <button className="quiet-action" type="button" onClick={() => setManualOpen((value) => !value)}>
              Координат оруулах
            </button>
            <button className="text-action" type="button" onClick={loadSavedLocation}>Өмнөх байршил</button>
          </div>
        </section>

        {manualOpen ? (
          <form className="coordinate-form" onSubmit={submitCoordinates}>
            <label><span>Өргөрөг</span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="47.9184" required /></label>
            <label><span>Уртраг</span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="106.9177" required /></label>
            <button type="submit" disabled={loading}>Төлөв харах</button>
          </form>
        ) : null}
        {error ? <div className="herder-error" role="alert">{error}</div> : null}

        {!forecast ? (
          <section className="empty-weather" aria-live="polite">
            <div className="empty-weather__visual" aria-hidden="true"><span>⌖</span><i /></div>
            <div>
              <p className="herder-kicker">Зохиомол тоо харуулахгүй</p>
              <h2>Байршлаа өгсний дараа төлөв гарна</h2>
              <p>Салхи, тунадас, хүйтрэлтийн бодит forecast татагдаагүй үед зөвлөмж өгөхгүй.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="current-grid" aria-labelledby="current-heading">
              <article className="current-card">
                <div className="card-topline">
                  <div>
                    <span className="live-dot">Шинэ төлөв</span>
                    <h2 id="current-heading">Одоо</h2>
                  </div>
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
                  <div className="alert-lead alert-lead--calm">
                    <strong>Хүчтэй үзэгдлийн код илрээгүй</strong>
                    <span>WMO кодын 24 цагийн төлөв</span>
                  </div>
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
                  {([
                    ["wind", "Салхи"],
                    ["precipitation", "Тунадас"],
                    ["cold", "Хүйтэн"],
                  ] as const).map(([value, label]) => (
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
        )}

        <section className="lost-livestock" id="livestock" aria-labelledby="livestock-heading">
          <div className="lost-livestock__intro">
            <span className="tool-icon" aria-hidden="true">⌕</span>
            <div><p className="herder-kicker">Хэрэгтэй үед</p><h2 id="livestock-heading">Мал алга болсон тэмдэглэл</h2><p>Сүүлд харсан мэдээллээ утсан дээрээ хадгал.</p></div>
          </div>
          <details className="lost-livestock__details">
            <summary>Тэмдэглэл нээх</summary>
            <form onSubmit={saveDraft}>
              <label><span>Мал</span><select value={draft.species} onChange={(event) => setDraft({ ...draft, species: event.target.value })}><option>Хонь</option><option>Ямаа</option><option>Адуу</option><option>Үхэр</option><option>Сарлаг</option><option>Тэмээ</option></select></label>
              <label><span>Тоо</span><input type="number" min="1" inputMode="numeric" value={draft.count} onChange={(event) => setDraft({ ...draft, count: event.target.value })} /></label>
              <label><span>Сүүлд харсан цаг</span><input type="datetime-local" value={draft.lastSeenTime} onChange={(event) => setDraft({ ...draft, lastSeenTime: event.target.value })} /></label>
              <label><span>Сүүлд харсан газар</span><input value={draft.lastSeenPlace} onChange={(event) => setDraft({ ...draft, lastSeenPlace: event.target.value })} placeholder="Уул, худаг, өвөлжөө…" /></label>
              <label className="wide-field"><span>Явсан зүг, таних шинж</span><textarea rows={3} value={draft.directionNote} onChange={(event) => setDraft({ ...draft, directionNote: event.target.value })} /></label>
              <div className="draft-actions wide-field"><button type="submit">Энэ утсанд хадгалах</button><button type="button" onClick={loadDraft}>Хадгалснаа нээх</button>{draftMessage ? <span role="status">{draftMessage}</span> : null}</div>
            </form>
          </details>
        </section>
      </main>

      <nav className="herder-mobile-nav" aria-label="Хурдан цэс">
        <a href="#today"><span aria-hidden="true">☀</span>Өнөөдөр</a>
        <a href="#pasture"><span aria-hidden="true">↑</span>Бэлчээр</a>
        <a href="#outlook"><span aria-hidden="true">≋</span>Төлөв</a>
        <a href="#livestock"><span aria-hidden="true">⌕</span>Мал хайх</a>
      </nav>
    </div>
  );
}
