import type { SVGProps } from "react";

export type SpriteIconName =
  | "arrow" | "back" | "bell" | "brand" | "clock" | "close" | "copy"
  | "database" | "droplet" | "fire" | "home" | "humidity" | "info"
  | "layers" | "lite" | "livestock" | "location" | "map" | "menu"
  | "message" | "pause" | "person" | "person-search" | "play" | "report"
  | "road" | "search" | "share" | "shield" | "sos" | "weather" | "wind";

export type SpriteIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  readonly name: SpriteIconName;
  readonly title?: string;
};

export function SpriteIcon({ name, title, ...props }: SpriteIconProps) {
  const decorative = !title;
  return (
    <svg
      viewBox={name === "brand" ? "0 0 40 40" : "0 0 24 24"}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/icons.svg#icon-${name}`} />
    </svg>
  );
}
