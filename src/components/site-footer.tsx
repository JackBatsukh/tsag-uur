import { BrandMark } from "@/components/icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div className="site-footer__brand">
          <BrandMark />
          <div>
            <strong>Tsag-uur</strong>
            <span>Монголын цаг агаарын мэдээллийг малчид, иргэд, тариаланч, судлаачидад илүү ойлгомжтой байдлаар харуулна.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
