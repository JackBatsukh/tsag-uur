import Link from "next/link";

import { BrandMark } from "@/components/icons";

const navigationItems = [
  { href: "/", label: "Цаг агаар" },
  { href: "/herder", label: "Малчин" },
  { href: "/farmer", label: "Тариаланч" },
  { href: "/dashboard", label: "Мэдээ" },
] as const;

export function AppHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <Link className="brand" href="/" aria-label="Tsag-uur нүүр хэсэг рүү очих">
          <span className="brand__mark">
            <BrandMark />
          </span>
          <span>
            <span className="brand__name">Tsag-uur</span>
            <span className="brand__descriptor">Weather Intelligence</span>
          </span>
        </Link>

        <nav className="primary-nav" aria-label="Үндсэн цэс">
          <ul className="primary-nav__list">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
