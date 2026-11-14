"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

import { forecastWindowFromTime, weatherCodeLabelMn } from "./forecast-utils";
import { DataBadge, Notice, ScreenHeading } from "./herder-ui";
import type { FireHotspotPayload, HerderForecastPayload, HerderView } from "./types";

async function requestForecast(latitude: number, longitude: number): Promise<HerderForecastPayload> {
  const response = await fetch(`/api/herder-forecast?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
  const body = await response.json() as HerderForecastPayload | { readonly error?: string };
  if (!response.ok || !("current" in body)) throw new Error("error" in body ? body.error : "Мэдээлэл татаж чадсангүй.");
  return body;
}

function FireView({ onBack }: { readonly onBack: () => void }) {
  const [payload, setPayload] = useState<FireHotspotPayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/fire-hotspots").then(async (response) => { const body = await response.json() as FireHotspotPayload; if (!response.ok) throw new Error(body.messageMn); if (active) setPayload(body); }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Мэдээлэл татаж чадсангүй."));
    return () => { active = false; };
  }, []);
  return <>
    <ScreenHeading title="Гал түймрийн мэдээлэл" description="Хиймэл дагуулын дулааны цэг ба албан ёсны баталгааг ялгана" onBack={onBack} />
    <Notice tone="danger" icon="fire"><strong>Гал харвал 101.</strong> NASA FIRMS-ийн цэг нь дулаан илрүүлэлт; батлагдсан түймэр эсвэл яг хил хязгаар биш.</Notice>
    <section className="data-card"><div className="data-card__header"><div><DataBadge kind="satellite">Хиймэл дагуулын өгөгдөл</DataBadge><h2>NASA FIRMS · VIIRS SNPP NRT</h2></div><a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">Эх сурвалж</a></div>
      {!payload && !error ? <p className="loading-row">Мэдээлэл шалгаж байна…</p> : null}{error ? <p className="form-errors" role="alert">{error}</p> : null}
      {payload ? <><p className="source-message">{payload.messageMn}</p><p className="timestamp">Сүүлд шалгасан: {new Intl.DateTimeFormat("mn-MN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.fetchedAt))}</p>{payload.hotspots.length ? <ul className="hotspot-list">{payload.hotspots.slice(0, 50).map((hotspot) => <li key={hotspot.id}><span className="hotspot-dot" /><div><strong>{hotspot.latitude.toFixed(3)}, {hotspot.longitude.toFixed(3)}</strong><small>{new Intl.DateTimeFormat("mn-MN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(hotspot.detectedAt))} UTC · Итгэлцүүр {hotspot.confidence}</small></div></li>)}</ul> : null}</> : null}
    </section><aside className="trust-strip"><SpriteIcon name="info" /><p>Хуучирсан өгөгдлийг “live” гэж нэрлэхгүй. FIRMS хүсэлт нь Монголын хил бус, улсыг хамарсан тэгш өнцөгт бүс тул хөрш улсын цэг орж болно. Монголын албан ёсны галын анхааруулгын эх сурвалж холбогдоогүй.</p></aside>
  </>;
}

function WeatherView({ onBack }: { readonly onBack: () => void }) {
  const [latitude, setLatitude] = useState("47.9184");
  const [longitude, setLongitude] = useState("106.9177");
  const [forecast, setForecast] = useState<HerderForecastPayload | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (lat: number, lon: number) => { setLoading(true); setStatus(""); try { setForecast(await requestForecast(lat, lon)); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Мэдээлэл татаж чадсангүй."); } finally { setLoading(false); } }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); const lat = Number(latitude); const lon = Number(longitude); if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { setStatus("Координатаа шалгана уу."); return; } void load(lat, lon); };
  const useLocation = () => navigator.geolocation?.getCurrentPosition((position) => { setLatitude(position.coords.latitude.toFixed(5)); setLongitude(position.coords.longitude.toFixed(5)); void load(position.coords.latitude, position.coords.longitude); }, () => setStatus("Байршлын зөвшөөрөлгүй. Координатаа гараар оруулна уу."));
  return <>
    <ScreenHeading title="Цаг агаар" description="Байршлын одоогийн төлөв ба дараагийн 24 цаг" onBack={onBack} />
    <form className="location-bar" onSubmit={submit}><label><span>Өргөрөг</span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label><label><span>Уртраг</span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label><button type="submit" disabled={loading}>{loading ? "Татаж байна…" : "Төлөв харах"}</button><button type="button" onClick={useLocation}><SpriteIcon name="location" />Миний байршил</button></form>
    {status ? <p className="action-status" role="alert">{status}</p> : null}
    {!forecast ? <section className="empty-state"><SpriteIcon name="weather" /><h2>Байршлаа сонгоно уу</h2><p>Зохиомол цаг агаар харуулахгүй. Сүлжээтэй үед Open-Meteo-оос урьдчилсан төлөв татна.</p></section> : <><section className="weather-now"><div><DataBadge kind="forecast">Урьдчилсан төлөв</DataBadge><p>Одоо</p><strong>{Math.round(forecast.current.temperatureC)}°</strong><span>{weatherCodeLabelMn(forecast.current.weatherCode)} · мэдрэгдэх {Math.round(forecast.current.apparentTemperatureC)}°</span></div><dl><div><dt>Салхи</dt><dd>{forecast.current.windSpeedMps.toFixed(1)} м/с</dd></div><div><dt>Ширүүсэлт</dt><dd>{forecast.current.windGustMps.toFixed(1)} м/с</dd></div><div><dt>Тунадас</dt><dd>{forecast.current.precipitationMm.toFixed(1)} мм</dd></div></dl></section><section className="hourly-card"><div className="data-card__header"><div><h2>Дараагийн 24 цаг</h2><p>{forecast.source.model}</p></div><span className="timestamp">{forecast.timezoneAbbreviation}</span></div><div className="hourly-list">{forecast.hourly.slice(0, 24).map((hour) => <article key={hour.time}><time>{new Intl.DateTimeFormat("mn-MN", { hour: "2-digit", minute: "2-digit", timeZone: forecast.timezone }).format(new Date(hour.time))}</time><strong>{Math.round(hour.temperatureC)}°</strong><span>{weatherCodeLabelMn(hour.weatherCode)}</span><small>Салхи {hour.windSpeedMps.toFixed(1)} м/с</small></article>)}</div></section><aside className="trust-strip"><SpriteIcon name="info" /><p>{forecast.limitationsMn.join(" ")}</p></aside></>}
  </>;
}

const EMPTY_ROAD_FORM = { from: "", to: "", fromLat: "", fromLon: "", toLat: "", toLon: "", departure: "" };

function validCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function RoadView({ onBack }: { readonly onBack: () => void }) {
  const [form, setForm] = useState(EMPTY_ROAD_FORM);
  const [result, setResult] = useState<{
    readonly request: typeof EMPTY_ROAD_FORM;
    readonly forecasts: readonly HerderForecastPayload[];
  } | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const plan = async (event: FormEvent) => {
    event.preventDefault();
    const from = [Number(form.fromLat), Number(form.fromLon)] as const;
    const to = [Number(form.toLat), Number(form.toLon)] as const;
    if (!validCoordinatePair(from[0], from[1]) || !validCoordinatePair(to[0], to[1])) {
      setStatus("Өргөрөг −90–90, уртраг −180–180 хооронд байх ёстой.");
      return;
    }
    if (form.departure && !Number.isFinite(Date.parse(form.departure))) {
      setStatus("Төлөвлөсөн огноо, цагаа шалгана уу.");
      return;
    }
    setLoading(true);
    setStatus("");
    setResult(null);
    try {
      const forecasts = await Promise.all([
        requestForecast(from[0], from[1]),
        requestForecast(to[0], to[1]),
      ]);
      if (form.departure && forecasts.some((forecast) => forecastWindowFromTime(forecast.hourly, form.departure).length === 0)) {
        throw new Error("Сонгосон явах цаг 36 цагийн урьдчилсан төлвийн хүрээнээс гадуур байна.");
      }
      setResult({ request: { ...form }, forecasts });
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Төлөв татаж чадсангүй.");
    } finally {
      setLoading(false);
    }
  };
  return <>
    <ScreenHeading title="Замын сэрэмжлүүлэг" description="Урт замын эхлэл ба төгсгөлийн цаг агаарын тойм" onBack={onBack} />
    <Notice tone="warning" icon="road"><strong>Маршрут тооцоолохгүй.</strong> Хоёр цэгийг шулуун шугамаар зам гэж үзэхгүй. Албан ёсны зам хаалтын суваг холбогдоогүй.</Notice>
    <form className="form-card" onSubmit={plan}><div className="form-grid"><label><span>Хаанаас</span><input required value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} placeholder="Сум, баг" /></label><label><span>Хаашаа</span><input required value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} placeholder="Сум, хот" /></label><label><span>Явах өргөрөг</span><input inputMode="decimal" required type="number" min="-90" max="90" step="any" value={form.fromLat} onChange={(event) => setForm({ ...form, fromLat: event.target.value })} /></label><label><span>Явах уртраг</span><input inputMode="decimal" required type="number" min="-180" max="180" step="any" value={form.fromLon} onChange={(event) => setForm({ ...form, fromLon: event.target.value })} /></label><label><span>Очих өргөрөг</span><input inputMode="decimal" required type="number" min="-90" max="90" step="any" value={form.toLat} onChange={(event) => setForm({ ...form, toLat: event.target.value })} /></label><label><span>Очих уртраг</span><input inputMode="decimal" required type="number" min="-180" max="180" step="any" value={form.toLon} onChange={(event) => setForm({ ...form, toLon: event.target.value })} /></label><label><span>Төлөвлөсөн цаг (заавал биш)</span><input type="datetime-local" value={form.departure} onChange={(event) => setForm({ ...form, departure: event.target.value })} /></label></div><button className="primary-button" type="submit" disabled={loading}>{loading ? "Хоёр цэгийн төлөв татаж байна…" : "Цаг агаарын эрсдэл шалгах"}</button></form>
    {status ? <p className="action-status" role="alert">{status}</p> : null}
    {result ? <section className="route-results">{result.forecasts.map((forecast, index) => { const hours = forecastWindowFromTime(forecast.hourly, result.request.departure); const maxGust = Math.max(...hours.map((hour) => hour.windGustMps)); const minVisibility = Math.min(...hours.map((hour) => hour.visibilityM)); const precipitation = hours.reduce((sum, hour) => sum + hour.precipitationMm, 0); const timeFormat = new Intl.DateTimeFormat("mn-MN", { dateStyle: "short", timeStyle: "short", timeZone: forecast.timezone }); return <article key={index ? "destination" : "origin"}><DataBadge kind="forecast">{index ? "Очих цэг" : "Явах цэг"}</DataBadge><h2>{index ? result.request.to : result.request.from}</h2><dl><div><dt>Салхины ширүүсэлт</dt><dd>{maxGust.toFixed(1)} м/с</dd></div><div><dt>{hours.length} цагийн тунадас</dt><dd>{precipitation.toFixed(1)} мм</dd></div><div><dt>Хамгийн бага үзэгдэх орчин</dt><dd>{Math.round(minVisibility / 1000)} км</dd></div></dl><p>Хүчинтэй: {timeFormat.format(new Date(hours[0]!.time))} – {timeFormat.format(new Date(hours.at(-1)!.time))} · {forecast.source.model}</p></article>; })}</section> : null}
    <aside className="trust-strip"><SpriteIcon name="info" /><p>Замын дундах нөхцөл, даваа, бодит явдаг зам, албан ёсны хаалтыг энэ хувилбар үнэлэхгүй.</p></aside>
  </>;
}

export function ConditionsViews({ view, onBack }: { readonly view: HerderView; readonly onBack: () => void }) {
  if (view === "fire") return <FireView onBack={onBack} />;
  if (view === "weather") return <WeatherView onBack={onBack} />;
  if (view === "road") return <RoadView onBack={onBack} />;
  return null;
}
