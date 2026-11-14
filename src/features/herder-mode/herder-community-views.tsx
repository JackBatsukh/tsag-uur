"use client";

import { type FormEvent, useState } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

import { DataBadge, Notice, ScreenHeading } from "./herder-ui";
import { validateCommunityReport } from "./safety";
import type { CommunityReportDraft, HerderView } from "./types";

const HERDER_STORAGE_PREFIX = "tsag-uur-herder-v2";
const CONTACTS_KEY = `${HERDER_STORAGE_PREFIX}-trusted-contacts`;
const REPORTS_KEY = `${HERDER_STORAGE_PREFIX}-reports`;
const EMPTY: CommunityReportDraft = { category: "", description: "", eventTime: "", locationNote: "", correctionOf: "" };
const CATEGORIES = ["Цасан шуурга", "Шороон шуурга", "Үер, ус", "Гал түймэр", "Зам хаагдсан", "Замын аюултай нөхцөл", "Алга болсон мал", "Сураггүй болсон хүн", "Буруу цаг агаарын мэдээлэл", "Бусад"] as const;

function ReportView({ onBack }: { readonly onBack: () => void }) {
  const [draft, setDraft] = useState<CommunityReportDraft>(EMPTY);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);
  const update = <Key extends keyof CommunityReportDraft>(key: Key, value: CommunityReportDraft[Key]) => { setDraft({ ...draft, [key]: value }); setSaved(false); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateCommunityReport(draft); setErrors(nextErrors); if (nextErrors.length) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? "[]") as unknown;
      const reports = Array.isArray(stored) ? stored : [];
      window.localStorage.setItem(REPORTS_KEY, JSON.stringify([...reports, { ...draft, id: crypto.randomUUID(), status: "draft", createdAt: new Date().toISOString() }]));
      setSaved(true); setDraft(EMPTY);
    } catch {
      setErrors(["Нооргийг энэ төхөөрөмжид хадгалж чадсангүй."]);
      setSaved(false);
    }
  };
  return <>
    <ScreenHeading title="Мэдээлэх / Залруулга санал болгох" description="Олон нийтийн мэдээллийг албан ёсны анхааруулгаас тусад нь хадгална" onBack={onBack} />
    <Notice icon="report"><strong>Одоогоор зөвхөн ноорог.</strong> Moderation backend холбогдоогүй тул “илгээгдсэн”, “баталгаажсан” гэж худал харуулахгүй.</Notice>
    <form className="form-card" onSubmit={save}><div className="form-grid"><label><span>Төрөл</span><select required value={draft.category} onChange={(event) => update("category", event.target.value)}><option value="">Сонгох</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>Үйл явдал болсон цаг</span><input type="datetime-local" value={draft.eventTime} onChange={(event) => update("eventTime", event.target.value)} /></label><label className="wide"><span>Тайлбар</span><textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Юу, хаана, хэзээ болсон бэ? Баттай ба таамаг мэдээллээ ялгана уу." /></label><label><span>Байршлын ерөнхий тайлбар</span><input value={draft.locationNote} onChange={(event) => update("locationNote", event.target.value)} placeholder="Яг гэрийн байршил бүү оруул" /></label><label><span>Залруулж буй ноорог</span><input value={draft.correctionOf} onChange={(event) => update("correctionOf", event.target.value)} placeholder="Ноорог ID эсвэл тайлбар" /></label></div>{errors.length ? <ul className="form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<button className="primary-button" type="submit">Энэ төхөөрөмжид ноорог хадгалах</button></form>
    {saved ? <div className="success-card" role="status"><SpriteIcon name="copy" /><div><strong>Ноорог хадгалагдлаа</strong><p>Төлөв: Draft. Сервер, хянагч, олон нийтэд илгээгээгүй.</p></div></div> : null}
    <section className="state-guide"><h2>Хяналтын төлөв</h2><div><span>Draft</span><span>Submitted</span><span>Awaiting review</span><span>Verified</span><span>Disputed</span><span>Rejected</span><span>Resolved</span></div><p>Local хувилбар зөвхөн Draft үүсгэнэ. Бусад төлөвийг бодит moderation backend удирдана.</p></section>
  </>;
}

function NotificationsView({ onBack }: { readonly onBack: () => void }) {
  return <><ScreenHeading title="Мэдэгдэл" description="Зөвшөөрсөн эх сурвалж, бодит хүргэлтийн төлөв" onBack={onBack} /><section className="empty-state"><SpriteIcon name="bell" /><h2>Идэвхтэй мэдэгдэл алга</h2><p>Browser push болон серверийн хуваарьт мэдэгдлийн backend тохируулаагүй. Хүргэсэн мэт хуурамч мэдэгдэл харуулахгүй.</p><DataBadge kind="local">Гараар шалгах горим</DataBadge></section><aside className="trust-strip"><SpriteIcon name="info" /><p>Ирээдүйд сэрэмжлүүлэг бүр эх сурвалж, шинэчилсэн цаг, зөвшөөрлийн төлөвтэй байна. Зохиомол өгөгдөл мэдэгдэл үүсгэхгүй.</p></aside></>;
}

function ProfileView({ contacts, setContacts, onBack }: { readonly contacts: string; readonly setContacts: (value: string) => void; readonly onBack: () => void }) {
  const [status, setStatus] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const saveContacts = () => { try { window.localStorage.setItem(CONTACTS_KEY, contacts); setStatus("Итгэлтэй хүмүүс зөвхөн энэ төхөөрөмжид хадгалагдлаа."); } catch { setStatus("Итгэлтэй хүмүүсийг энэ төхөөрөмжид хадгалж чадсангүй."); } };
  const clearLocal = () => {
    if (!confirmClear) { setConfirmClear(true); setStatus("Устгалтыг батлахын тулд улаан товчийг дахин дарна уу."); return; }
    try {
      Object.keys(window.localStorage).filter((key) => key.startsWith(HERDER_STORAGE_PREFIX)).forEach((key) => window.localStorage.removeItem(key));
      setContacts(""); setStatus("Herder Mode-ийн локал мэдээллийг энэ төхөөрөмжөөс устгалаа."); setConfirmClear(false);
    } catch { setStatus("Локал мэдээллийг бүрэн устгаж чадсангүй. Browser-ийн site data тохиргоог шалгана уу."); }
  };
  return <>
    <ScreenHeading title="Миний хэсэг" description="Итгэлтэй хүмүүс, интеграц, локал өгөгдлийн хяналт" onBack={onBack} />
    <section className="form-card"><div className="section-title"><span><SpriteIcon name="person" /></span><div><h2>Итгэлтэй хүмүүс</h2><p>Дугаар эсвэл нэрийг таслалаар тусгаарлана. Автоматаар мессеж илгээхгүй.</p></div></div><label><span>Холбоо барих хүмүүс</span><textarea value={contacts} onChange={(event) => { setContacts(event.target.value); setStatus(""); }} placeholder="9911xxxx — гэр бүл, 8811xxxx — багийн хүн" /></label><button className="primary-button" type="button" onClick={saveContacts}>Энэ төхөөрөмжид хадгалах</button></section>
    <section className="integration-list"><h2>Интеграцийн төлөв</h2><article><SpriteIcon name="message" /><div><strong>Verify.mn баталгаажуулалт</strong><p>API түлхүүр, серверийн session урсгал тохируулаагүй. Verify.mn нь гадагш SMS цацах үйлчилгээ биш.</p></div><DataBadge kind="local">Тохируулаагүй</DataBadge></article><article><SpriteIcon name="bell" /><div><strong>Push / outbound SMS</strong><p>Хүргэлтийн provider ба backend холбогдоогүй. Manual share л идэвхтэй.</p></div><DataBadge kind="local">Тохируулаагүй</DataBadge></article></section>
    <section className="danger-zone"><h2>Локал өгөгдөл</h2><p>Herder Mode-ийн ноорог, итгэлтэй хүмүүсийн мэдээллийг устгана. Буцаах боломжгүй.</p><div className="button-row"><button type="button" onClick={clearLocal}>{confirmClear ? "Тийм, бүрмөсөн устгах" : "Миний локал өгөгдлийг устгах"}</button>{confirmClear ? <button type="button" onClick={() => { setConfirmClear(false); setStatus("Устгалтыг цуцаллаа."); }}>Цуцлах</button> : null}</div></section>{status ? <p className="action-status" role="status">{status}</p> : null}
  </>;
}

export function CommunityViews({ view, contacts, setContacts, onBack }: { readonly view: HerderView; readonly contacts: string; readonly setContacts: (value: string) => void; readonly onBack: () => void }) {
  if (view === "report") return <ReportView onBack={onBack} />;
  if (view === "notifications") return <NotificationsView onBack={onBack} />;
  if (view === "profile") return <ProfileView contacts={contacts} setContacts={setContacts} onBack={onBack} />;
  return null;
}
