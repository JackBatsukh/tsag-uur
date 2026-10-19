import { DatabaseIcon, InfoIcon, ShieldIcon } from "@/components/icons";

const transparencyItems = [
  {
    title: "Жишээ өгөгдөл",
    description:
      "Температур, салхи, хур тунадасны бүх утгыг UI хөгжүүлэлтэд зориулан тогтмол бичсэн. Эдгээр нь хэмжилт эсвэл бодит загварын гаралт биш.",
    icon: <DatabaseIcon key="database" />,
  },
  {
    title: "Нарийвчлалын хязгаар",
    description:
      "27 км гэсэн нягтаршил ч мөн интерфейсийн жишээ. Бодит эх үүсвэр баталгаажаагүй үед гудамж, хорооны түвшний нарийвчлал амлахгүй.",
    icon: <InfoIcon key="information" />,
  },
  {
    title: "Албан ёсны мэдэгдэл биш",
    description:
      "Энэ хувилбар эрсдэлийн босго, аюулын зэрэглэл эсвэл аюулгүй байдлын зөвлөмж гаргахгүй. Тийм дүрмийг домэйн мэргэжилтэн баталгаажуулсны дараа нэвтрүүлнэ.",
    icon: <ShieldIcon key="shield" />,
  },
] as const;

export function DataTransparency() {
  return (
    <section className="transparency-section" id="transparency" aria-labelledby="transparency-title">
      <div className="section-heading section-heading--transparency">
        <div>
          <p className="eyebrow">Шинжлэх ухааны зарчим</p>
          <h2 id="transparency-title">Өгөгдлийн ил тод байдал</h2>
        </div>
        <p className="section-heading__description">
          Хэрэглэгч харагдаж буй мэдээлэл хаанаас, ямар хязгаарлалттай ирснийг үргэлж мэдэх ёстой.
        </p>
      </div>

      <div className="transparency-grid">
        {transparencyItems.map((item, index) => (
          <article className="transparency-card" key={item.title}>
            <div className="transparency-card__topline">
              <span className="transparency-card__icon">{item.icon}</span>
              <span className="transparency-card__number" aria-hidden="true">
                0{index + 1}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
