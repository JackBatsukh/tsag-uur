import { BrandMark } from "@/components/icons";

const navigationItems = [
  { href: "#overview", label: "Тойм" },
  { href: "#hourly", label: "Цаг тутам" },
  { href: "#model", label: "Загварын мэдээлэл" },
  { href: "#transparency", label: "Ил тод байдал" },
] as const;

export function AppHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <a className="brand" href="#top" aria-label="Tsag-uur нүүр хэсэг рүү очих">
          <span className="brand__mark">
            <BrandMark />
          </span>
          <span>
            <span className="brand__name">Tsag-uur</span>
            <span className="brand__descriptor">Weather Intelligence</span>
          </span>
        </a>

        <nav className="primary-nav" aria-label="Үндсэн цэс">
          <ul className="primary-nav__list">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="environment-badge" title="Энэ хувилбар бодит өгөгдөл ашиглахгүй">
          <span className="environment-badge__dot" aria-hidden="true" />
          Demo орчин
        </div>
      </div>
    </header>
  );
}
