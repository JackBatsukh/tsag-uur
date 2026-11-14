"use client";

import { useMemo, useState } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

import { ScreenHeading, Notice } from "./herder-ui";
import { buildEmergencyMessage, manualSmsHref } from "./safety";
import type { EmergencyDraft } from "./types";

const EMPTY: EmergencyDraft = { category: "stranded", description: "", contactName: "", latitude: "", longitude: "" };
const NUMBERS = [{ number: "101", label: "Гал түймэр" }, { number: "102", label: "Цагдаа" }, { number: "103", label: "Түргэн" }, { number: "105", label: "Онцгой байдал" }] as const;

export function SosView({ contacts, onBack }: { readonly contacts: string; readonly onBack: () => void }) {
  const [draft, setDraft] = useState<EmergencyDraft>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState("");
  const message = useMemo(() => buildEmergencyMessage(draft), [draft]);

  const useLocation = () => {
    if (!navigator.geolocation) { setStatus("Координатаа гараар оруулна уу."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setDraft((value) => ({ ...value, latitude: position.coords.latitude.toFixed(5), longitude: position.coords.longitude.toFixed(5) })),
      () => setStatus("Байршлын зөвшөөрөлгүй. SOS байршилгүйгээр ажиллана."),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setStatus("Мессеж хуулсан. Хаашаа илгээхээ та өөрөө сонгоно."); }
    catch { setStatus("Автоматаар хуулж чадсангүй. Текстийг гараар хуулна уу."); }
  };
  const share = async () => {
    if (!navigator.share) { setStatus("Хуваалцах цонх дэмжигдээгүй. SMS эсвэл хуулахыг ашиглана уу."); return; }
    try { await navigator.share({ title: "SOS тусламж", text: message }); setStatus("Хуваалцах цонх хаагдсан. Хүргэлтийг Tsag-uur батлах боломжгүй."); }
    catch { setStatus("Хуваалцах үйлдэл цуцлагдсан эсвэл дуусаагүй."); }
  };

  return <>
    <ScreenHeading title="SOS тусламж" description="Дуудлага хийх эсвэл итгэлтэй хүндээ мессеж бэлтгэх" onBack={onBack} />
    <section className="emergency-numbers" aria-label="Албан ёсны яаралтай тусламжийн дугаар">{NUMBERS.map((item) => <a href={`tel:${item.number}`} key={item.number}><strong>{item.number}</strong><span>{item.label}</span><small>Залгах</small></a>)}</section>
    <Notice tone="danger" icon="sos"><strong>Автоматаар дуудлага хийхгүй.</strong> Дугаар дээр дарахад утасны цонх нээгдэнэ; эцсийн залгах үйлдлийг та хийнэ.</Notice>
    <section className="form-card"><div className="section-title"><span>1</span><div><h2>Тусламжийн мэдээлэл</h2><p>Хамгийн чухал зүйлээ товч бичнэ үү.</p></div></div><div className="form-grid">
      <label><span>Тусламжийн төрөл</span><select value={draft.category} onChange={(event) => { setDraft({ ...draft, category: event.target.value as EmergencyDraft["category"] }); setPreview(false); }}><option value="stranded">Хүн төөрсөн / саатсан</option><option value="medical">Эмнэлгийн тусламж</option><option value="vehicle">Машин эвдэрсэн</option><option value="livestock">Малтай холбоотой</option><option value="snowstorm">Цасан шуурга / зуд</option><option value="other">Бусад</option></select></label>
      <label><span>Таны нэр эсвэл таних нэр</span><input value={draft.contactName} onChange={(event) => { setDraft({ ...draft, contactName: event.target.value }); setPreview(false); }} placeholder="Бат — Хар-Ус баг" /></label>
      <label className="wide"><span>Юу болсон бэ?</span><textarea value={draft.description} onChange={(event) => { setDraft({ ...draft, description: event.target.value }); setPreview(false); }} placeholder="Нөхцөл, хэдэн хүн, ямар тусламж хэрэгтэйг бичнэ үү." /></label>
      <div className="coordinate-fields wide"><label><span>Өргөрөг</span><input inputMode="decimal" value={draft.latitude} onChange={(event) => setDraft({ ...draft, latitude: event.target.value })} placeholder="47.9184" /></label><label><span>Уртраг</span><input inputMode="decimal" value={draft.longitude} onChange={(event) => setDraft({ ...draft, longitude: event.target.value })} placeholder="106.9177" /></label><button className="secondary-button" type="button" onClick={useLocation}><SpriteIcon name="location" />Одоогийн байршил</button></div>
    </div><div className="contact-note"><SpriteIcon name="person" /><span>Итгэлтэй хүмүүс: {contacts.trim() || "Миний хэсэгт дугаар оруулаагүй"}</span></div><button className="primary-button" type="button" onClick={() => setPreview(true)}>2. Мессежээ урьдчилан харах</button></section>
    {preview ? <section className="preview-card" aria-live="polite"><div className="section-title"><span>2</span><div><h2>Та өөрөө баталж хуваалцана</h2><p>Tsag-uur хүргэлтийг баталгаажуулахгүй.</p></div></div><pre>{message}</pre><div className="share-actions"><button type="button" onClick={copy}><SpriteIcon name="copy" />Хуулах</button><button type="button" onClick={share}><SpriteIcon name="share" />Хуваалцах</button><a href={manualSmsHref(message)} onClick={() => setStatus("SMS апп нээгдлээ. Илгээх товчийг та өөрөө дарна.")}><SpriteIcon name="message" />SMS нээх</a></div></section> : null}
    {status ? <p className="action-status" role="status">{status}</p> : null}
    <details className="offline-help"><summary>Офлайн үед хийх зүйл</summary><ol><li>105 эсвэл нөхцөлдөө тохирох дугаар руу залгах.</li><li>Координат, ойрын уул ус, багийн нэрээ хэлэх.</li><li>Дулаан, хоргодох байр, ус, цэнэгээ хамгаалах.</li><li>Мессеж хүрсэн эсэхийг утас/SMS апп дээрээ шалгах.</li></ol></details>
  </>;
}
