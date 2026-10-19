import { BrandMark } from "@/components/icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div className="site-footer__brand">
          <BrandMark />
          <div>
            <strong>Tsag-uur</strong>
            <span>Монголын цаг агаарын мэдээллийг илүү ойлгомжтой болгоно.</span>
          </div>
        </div>
        <p>
          Phase 1 · UI prototype
          <span aria-hidden="true">•</span>
          Бүх утга зохиомол жишээ
        </p>
      </div>
    </footer>
  );
}
