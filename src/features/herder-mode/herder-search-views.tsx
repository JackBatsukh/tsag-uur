"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

import { DynamicLivestockSearchMap } from "./dynamic-livestock-search-map";
import { buildLivestockSearchAreas } from "./forecast-utils";
import { DataBadge, Notice, ScreenHeading } from "./herder-ui";
import { buildLivestockMessage, manualSmsHref, validateLivestockShare, validateMissingPersonDraft } from "./safety";
import type { HerderView, LivestockSearchPayload, MissingLivestockDraft, MissingPersonDraft } from "./types";

const LIVESTOCK_KEY = "tsag-uur-herder-v2-livestock";
const PERSON_KEY = "tsag-uur-herder-v2-person";
const EMPTY_LIVESTOCK: MissingLivestockDraft = { species: "Хонь", count: "", lastSeenTime: "", lastSeenPlace: "", directionNote: "", lastSeenLatitude: "", lastSeenLongitude: "", observedDirectionDegrees: "", maxSearchKm: "15" };
const EMPTY_PERSON: MissingPersonDraft = { identifyingDescription: "", lastKnownPlace: "", lastSeenTime: "", weatherNote: "", coordinatorContact: "", authorizationConfirmed: false, vulnerablePerson: false };

function restore<Value>(key: string, fallback: Value): Value {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as Value : fallback; }
  catch { return fallback; }
}

function validCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

async function requestHistory(draft: MissingLivestockDraft): Promise<LivestockSearchPayload> {
  const response = await fetch(`/api/livestock-search?lat=${Number(draft.lastSeenLatitude)}&lon=${Number(draft.lastSeenLongitude)}&lastSeen=${encodeURIComponent(new Date(draft.lastSeenTime).toISOString())}`, { cache: "no-store" });
  const body = await response.json() as LivestockSearchPayload | { readonly error?: string };
  if (!response.ok || !("analysis" in body)) throw new Error("error" in body ? body.error : "Архив татаж чадсангүй.");
  return body;
}

function LivestockView({ contacts, onBack }: { readonly contacts: string; readonly onBack: () => void }) {
  const [draft, setDraft] = useState<MissingLivestockDraft>(EMPTY_LIVESTOCK);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState<LivestockSearchPayload | null>(null);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setDraft(restore(LIVESTOCK_KEY, EMPTY_LIVESTOCK)), 0); return () => window.clearTimeout(timer); }, []);
  const trustedCount = contacts.split(/[,\n]/).filter((value) => value.trim()).length;
  const message = useMemo(() => buildLivestockMessage(draft), [draft]);
  const areas = useMemo(() => search ? buildLivestockSearchAreas(search.location, search.analysis, Number(draft.maxSearchKm), draft.observedDirectionDegrees ? Number(draft.observedDirectionDegrees) : null) : [], [draft.maxSearchKm, draft.observedDirectionDegrees, search]);
  const update = <Key extends keyof MissingLivestockDraft>(key: Key, value: MissingLivestockDraft[Key]) => {
    const next = { ...draft, [key]: value }; setDraft(next); setPreview(false); setSearch(null);
    try { window.localStorage.setItem(LIVESTOCK_KEY, JSON.stringify(next)); }
    catch { setStatus("Нооргийг энэ төхөөрөмжид хадгалж чадсангүй."); }
  };
  const prepare = () => { const nextErrors = validateLivestockShare(draft, trustedCount); setErrors(nextErrors); setPreview(nextErrors.length === 0); };
  const analyze = async () => {
    const latitude = Number(draft.lastSeenLatitude);
    const longitude = Number(draft.lastSeenLongitude);
    if (!draft.lastSeenLatitude.trim() || !draft.lastSeenLongitude.trim() || !validCoordinatePair(latitude, longitude)) { setStatus("Архивын нөлөө харахын тулд хүчинтэй координат оруулна уу."); return; }
    if (!Number.isFinite(Date.parse(draft.lastSeenTime))) { setStatus("Сүүлд харсан огноо, цагаа шалгана уу."); return; }
    setSearching(true); setStatus("");
    try { setSearch(await requestHistory(draft)); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Архив татаж чадсангүй."); }
    finally { setSearching(false); }
  };
  return <>
    <ScreenHeading title="Алга болсон мал" description="Ноорог → шалгах → зөвхөн сонгосон хүмүүст хуваалцах" onBack={onBack} />
    <Notice icon="shield"><strong>Нууцлал:</strong> яг байршлыг нийтэд нийтлэхгүй. SMS болон хуваалцах цонхыг та өөрөө нээнэ.</Notice>
    <section className="form-card"><div className="section-title"><span>1</span><div><h2>Малын мэдээлэл</h2><p>Ноорог зөвхөн энэ төхөөрөмжид хадгалагдана.</p></div></div><div className="form-grid">
      <label><span>Малын төрөл</span><select value={draft.species} onChange={(event) => update("species", event.target.value)}><option>Хонь</option><option>Ямаа</option><option>Адуу</option><option>Үхэр</option><option>Сарлаг</option><option>Тэмээ</option></select></label><label><span>Тоо</span><input inputMode="numeric" min="1" type="number" value={draft.count} onChange={(event) => update("count", event.target.value)} placeholder="12" /></label>
      <label><span>Сүүлд харсан цаг</span><input type="datetime-local" value={draft.lastSeenTime} onChange={(event) => update("lastSeenTime", event.target.value)} /></label><label><span>Сүүлд харсан газар</span><input value={draft.lastSeenPlace} onChange={(event) => update("lastSeenPlace", event.target.value)} placeholder="Баг, уул усны нэр" /></label>
      <label className="wide"><span>Чиглэл, зүс, им, онцлог</span><textarea value={draft.directionNote} onChange={(event) => update("directionNote", event.target.value)} placeholder="Баруун хойш явсан, улаан будагтай..." /></label>
      <div className="coordinate-fields wide"><label><span>Өргөрөг</span><input inputMode="decimal" value={draft.lastSeenLatitude} onChange={(event) => update("lastSeenLatitude", event.target.value)} placeholder="47.9184" /></label><label><span>Уртраг</span><input inputMode="decimal" value={draft.lastSeenLongitude} onChange={(event) => update("lastSeenLongitude", event.target.value)} placeholder="106.9177" /></label><label><span>Хайх дээд зай (км)</span><input inputMode="numeric" min="1" max="100" type="number" value={draft.maxSearchKm} onChange={(event) => update("maxSearchKm", event.target.value)} /></label></div>
    </div><div className="contact-note"><SpriteIcon name="person" /><span>{trustedCount ? `${trustedCount} итгэлтэй холбоо барих хүн` : "Миний хэсэгт итгэлтэй хүний дугаар оруулна уу"}</span></div>{errors.length ? <ul className="form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<div className="button-row"><button className="primary-button" type="button" onClick={prepare}>2. Хуваалцахын өмнө шалгах</button><button className="secondary-button" type="button" onClick={analyze} disabled={searching}>{searching ? "Татаж байна…" : "Өнгөрсөн цаг агаар шалгах"}</button></div></section>
    {preview ? <section className="preview-card"><DataBadge kind="local">Илгээгээгүй ноорог</DataBadge><h2>Мессежийн урьдчилсан харагдац</h2><pre>{message}</pre><div className="share-actions"><button type="button" onClick={() => void navigator.clipboard.writeText(message).then(() => setStatus("Мессеж хуулсан. Хүргэлт баталгаажаагүй.")).catch(() => setStatus("Автоматаар хуулж чадсангүй. Текстийг гараар хуулна уу."))}><SpriteIcon name="copy" />Хуулах</button><a href={manualSmsHref(message)} onClick={() => setStatus("SMS апп нээгдлээ. Илгээх үйлдлийг та өөрөө хийнэ.")}><SpriteIcon name="message" />SMS нээх</a></div></section> : null}
    {search ? <section className="analysis-card"><div><DataBadge kind="forecast">Архивлагдсан загвар</DataBadge><h2>Хайх бүсийн туслах мэдээлэл</h2><p>{search.analysis.hoursConsidered} цагийн салхи, тунадасны мэдээлэл. GPS мөр, магадлал, одоогийн байршил биш.</p></div><dl><div><dt>Хамгийн хүчтэй салхи</dt><dd>{search.analysis.strongestWindMps.toFixed(1)} м/с</dd></div><div><dt>Нийт тунадас</dt><dd>{search.analysis.totalPrecipitationMm.toFixed(1)} мм</dd></div><div><dt>Цас</dt><dd>{search.analysis.totalSnowfallCm.toFixed(1)} см</dd></div></dl><button className="secondary-button" type="button" onClick={() => setShowMap((value) => !value)}>{showMap ? "Газрын зураг хаах" : "Хайлтын зураг нээх"}</button>{showMap ? <DynamicLivestockSearchMap location={search.location} areas={areas} onSelectLocation={(point) => { const next = { ...draft, lastSeenLatitude: point.latitude.toFixed(5), lastSeenLongitude: point.longitude.toFixed(5) }; setDraft(next); window.localStorage.setItem(LIVESTOCK_KEY, JSON.stringify(next)); setSearch(null); }} /> : null}</section> : null}
    {status ? <p className="action-status" role="status">{status}</p> : null}
  </>;
}

function PersonView({ onBack }: { readonly onBack: () => void }) {
  const [draft, setDraft] = useState<MissingPersonDraft>(EMPTY_PERSON);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setDraft(restore(PERSON_KEY, EMPTY_PERSON)), 0); return () => window.clearTimeout(timer); }, []);
  const update = <Key extends keyof MissingPersonDraft>(key: Key, value: MissingPersonDraft[Key]) => { setDraft({ ...draft, [key]: value }); setSaved(false); };
  const save = (event: FormEvent) => { event.preventDefault(); const nextErrors = validateMissingPersonDraft(draft); setErrors(nextErrors); if (nextErrors.length) return; try { window.localStorage.setItem(PERSON_KEY, JSON.stringify(draft)); setSaved(true); } catch { setErrors(["Нооргийг энэ төхөөрөмжид хадгалж чадсангүй."]); setSaved(false); } };
  return <>
    <ScreenHeading title="Сураггүй болсон хүн хайх" description="Нийтэд нээлттэй сан биш — зохион байгуулагчийн дотоод төлөвлөгөө" onBack={onBack} />
    <Notice tone="warning" icon="shield"><strong>Эмзэг мэдээлэл:</strong> зөвшөөрөлгүй нэр, зураг, яг байршлыг нийтэд бүү тавь. Хүүхдийн мэдээллийг эрх бүхий байгууллагатай хуваалцана.</Notice>
    <section className="official-actions"><a href="tel:102"><strong>102</strong><span>Цагдаад мэдэгдэх</span></a><a href="tel:105"><strong>105</strong><span>Онцгой байдлаас тусламж авах</span></a></section>
    <form className="form-card" onSubmit={save}><div className="section-title"><span>1</span><div><h2>Хайлтын дотоод ноорог</h2><p>Сервер рүү илгээхгүй, нийтэд харуулахгүй.</p></div></div><div className="form-grid">
      <label className="wide"><span>Нэр эсвэл таних тайлбар</span><input value={draft.identifyingDescription} onChange={(event) => update("identifyingDescription", event.target.value)} placeholder="Зөвшөөрөгдсөн хэмжээнд" /></label><label><span>Сүүлд байсан газар</span><input value={draft.lastKnownPlace} onChange={(event) => update("lastKnownPlace", event.target.value)} /></label><label><span>Сүүлд харсан цаг</span><input type="datetime-local" value={draft.lastSeenTime} onChange={(event) => update("lastSeenTime", event.target.value)} /></label><label><span>Тухайн үеийн цаг агаар</span><input value={draft.weatherNote} onChange={(event) => update("weatherNote", event.target.value)} placeholder="Мэдэж байвал" /></label><label><span>Зохицуулагчийн холбоо</span><input value={draft.coordinatorContact} onChange={(event) => update("coordinatorContact", event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={draft.vulnerablePerson} onChange={(event) => update("vulnerablePerson", event.target.checked)} /><span>Хүүхэд эсвэл эмзэг хүн</span></label><label className="check-field wide"><input type="checkbox" checked={draft.authorizationConfirmed} onChange={(event) => update("authorizationConfirmed", event.target.checked)} /><span>Би энэ мэдээллийг дотоод төлөвлөгөөнд ашиглах зохих эрх / зөвшөөрөлтэй.</span></label>
    </div>{errors.length ? <ul className="form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<button className="primary-button" type="submit">Энэ төхөөрөмжид ноорог хадгалах</button></form>
    {saved ? <div className="success-card" role="status"><SpriteIcon name="shield" /><div><strong>Дотоод ноорог хадгалагдлаа</strong><p>Нийтлээгүй, хэн нэгэнд илгээгээгүй.</p></div></div> : null}
    <section className="planner-card"><h2>Хайлтын бүс төлөвлөх зарчим</h2><ol><li>Сүүлд баталгаатай байсан цэгийг тэмдэглэ.</li><li>Хайсан бүсээ зохион байгуулагч өөрөө тэмдэглэ.</li><li>Баталгаатай ба баталгаагүй ажиглалтыг тусад нь хөтөл.</li><li>Салхинаас хүний одоогийн байршлыг бүү таа.</li></ol><p className="muted-note">Backend, moderation, access control-гүй тул олон нийтэд нийтлэх боломж зориудаар хаалттай.</p></section>
  </>;
}

export function SearchViews({ view, contacts, onBack }: { readonly view: HerderView; readonly contacts: string; readonly onBack: () => void }) {
  if (view === "livestock") return <LivestockView contacts={contacts} onBack={onBack} />;
  if (view === "person") return <PersonView onBack={onBack} />;
  return null;
}
