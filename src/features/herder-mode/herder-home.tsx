import { SpriteIcon, type SpriteIconName } from "@/components/sprite-icon";

import type { HerderView } from "./types";
import { DataBadge } from "./herder-ui";

const ACTIONS: readonly { view: HerderView; icon: SpriteIconName; title: string; description: string; tone: string }[] = [
  { view: "person", icon: "person-search", title: "Хүн хайх", description: "Нууцлалтай хайлтын төлөвлөгөө", tone: "blue" },
  { view: "livestock", icon: "livestock", title: "Мал хайх", description: "Сүүлд харсан цэг, итгэлтэй хүмүүс", tone: "ochre" },
  { view: "sos", icon: "sos", title: "SOS тусламж", description: "Дуудлага, SMS, байршил", tone: "red" },
  { view: "fire", icon: "fire", title: "Гал түймэр", description: "NASA FIRMS дулааны цэг", tone: "orange" },
  { view: "weather", icon: "weather", title: "Цаг агаар", description: "Загварын одоогийн төлөв ба 24 цаг", tone: "teal" },
  { view: "road", icon: "road", title: "Замын сэрэмжлүүлэг", description: "Аяллын хоёр цэгийн төлөв", tone: "violet" },
];

export function HerderHome({ online, openView }: { readonly online: boolean; readonly openView: (view: HerderView) => void }) {
  return <>
    <section className="home-hero" aria-labelledby="herder-home-title"><div><p className="eyebrow">Малчин горим 2.0</p><h1 id="herder-home-title">Танд юу хэрэгтэй вэ?</h1><p>Яаралтай үед цөөн алхам. Хуваалцахын өмнө та мэдээллээ шалгаж батална.</p></div><div className={`network-pill ${online ? "is-online" : "is-offline"}`} role="status"><span />{online ? "Сүлжээтэй" : "Офлайн — дуудлага, ноорог ажиллана"}</div></section>
    <section className="quick-actions" aria-label="Үндсэн үйлдлүүд">{ACTIONS.map((action) => <button className={`action-card action-card--${action.tone}`} type="button" key={action.view} onClick={() => openView(action.view)}><span className="action-card__icon"><SpriteIcon name={action.icon} /></span><span><strong>{action.title}</strong><small>{action.description}</small></span><SpriteIcon className="action-card__arrow" name="arrow" /></button>)}</section>
    <section className="home-lower-grid"><article className="status-card status-card--safe"><div className="status-card__icon"><SpriteIcon name="shield" /></div><div><DataBadge kind="official">Албан ёсны дугаар</DataBadge><h2>Яаралтай тусламж</h2><p>101 · 102 · 103 · 105 дугаарууд руу зөвхөн та өөрөө залгана.</p></div><button type="button" onClick={() => openView("sos")}>Дуудлага харах</button></article><article className="status-card"><div className="status-card__icon"><SpriteIcon name="report" /></div><div><DataBadge kind="community">Олон нийтийн мэдээлэл</DataBadge><h2>Мэдээлэх, залруулах</h2><p>Оруулсан зүйл энэ төхөөрөмжид ноорог болно. Албан ёсны анхааруулга болохгүй.</p></div><button type="button" onClick={() => openView("report")}>Ноорог үүсгэх</button></article></section>
    <aside className="trust-strip"><SpriteIcon name="info" /><p><strong>Итгэлтэй мэдээлэл.</strong> Урьдчилсан төлөв, хиймэл дагуул, олон нийтийн ноорог тусдаа тэмдэглэгээтэй. Tsag-uur аврах албыг орлохгүй.</p></aside>
  </>;
}
