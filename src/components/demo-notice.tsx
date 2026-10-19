import { InfoIcon } from "@/components/icons";

interface DemoNoticeProps {
  readonly disclaimer: string;
}

export function DemoNotice({ disclaimer }: DemoNoticeProps) {
  return (
    <aside className="demo-notice" aria-labelledby="demo-notice-title">
      <span className="demo-notice__icon">
        <InfoIcon />
      </span>
      <div>
        <p className="demo-notice__eyebrow" id="demo-notice-title">
          Туршилтын өгөгдөл
        </p>
        <p>{disclaimer}</p>
      </div>
      <a className="demo-notice__link" href="#transparency">
        Дэлгэрэнгүй
        <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}
