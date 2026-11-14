import type { ReactNode } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

export function ScreenHeading({ title, description, onBack }: { readonly title: string; readonly description: string; readonly onBack: () => void }) {
  return <div className="screen-heading"><button className="icon-button" type="button" onClick={onBack} aria-label="Нүүр рүү буцах"><SpriteIcon name="back" /></button><div><h1>{title}</h1><p>{description}</p></div></div>;
}

export function DataBadge({ kind, children }: { readonly kind: "official" | "satellite" | "forecast" | "community" | "local"; readonly children: ReactNode }) {
  return <span className={`data-badge data-badge--${kind}`}>{children}</span>;
}

export function Notice({ tone = "default", icon = "info", children }: { readonly tone?: "default" | "warning" | "danger"; readonly icon?: "info" | "shield" | "sos" | "fire" | "road" | "report"; readonly children: ReactNode }) {
  return <div className={`safety-callout safety-callout--${tone}`}><SpriteIcon name={icon} /><p>{children}</p></div>;
}
