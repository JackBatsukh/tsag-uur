import type { SVGProps } from "react";

import { SpriteIcon } from "@/components/sprite-icon";
import type { WeatherSymbol } from "@/types/weather";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "name">;

export const BrandMark = (props: IconProps) => <SpriteIcon name="brand" {...props} />;
export const LocationIcon = (props: IconProps) => <SpriteIcon name="location" {...props} />;
export const ClockIcon = (props: IconProps) => <SpriteIcon name="clock" {...props} />;
export const WindIcon = (props: IconProps) => <SpriteIcon name="wind" {...props} />;
export const DropletIcon = (props: IconProps) => <SpriteIcon name="droplet" {...props} />;
export const HumidityIcon = (props: IconProps) => <SpriteIcon name="humidity" {...props} />;
export const DatabaseIcon = (props: IconProps) => <SpriteIcon name="database" {...props} />;
export const ShieldIcon = (props: IconProps) => <SpriteIcon name="shield" {...props} />;
export const InfoIcon = (props: IconProps) => <SpriteIcon name="info" {...props} />;
export const ArrowIcon = (props: IconProps) => <SpriteIcon name="arrow" {...props} />;

const sharedProps = { "aria-hidden": true, focusable: false } as const;

/** Dynamic weather glyphs remain inline because they are data marks, not UI icons. */
export function WeatherGlyph({ symbol, ...props }: IconProps & { symbol: WeatherSymbol }) {
  if (symbol === "clear") {
    return (
      <svg viewBox="0 0 48 48" fill="none" {...sharedProps} {...props}>
        <circle cx="24" cy="24" r="8" fill="currentColor" opacity=".9" />
        <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M36.7 11.3l-4.2 4.2M15.5 32.5l-4.2 4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (symbol === "light-snow") {
    return (
      <svg viewBox="0 0 48 48" fill="none" {...sharedProps} {...props}>
        <path d="M14 30h22a7 7 0 0 0 .4-14 11 11 0 0 0-20.8-2.4A8.3 8.3 0 0 0 14 30Z" fill="currentColor" opacity=".16" />
        <path d="M14 30h22a7 7 0 0 0 .4-14 11 11 0 0 0-20.8-2.4A8.3 8.3 0 0 0 14 30Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m17 36 2 2m0-2-2 2m7-2 2 2m0-2-2 2m7-2 2 2m0-2-2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" {...sharedProps} {...props}>
      {symbol === "partly-cloudy" ? (
        <>
          <circle cx="18" cy="17" r="7" fill="currentColor" opacity=".22" />
          <path d="M18 6v3M7 17h3M10.2 9.2l2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : null}
      <path d="M12.5 36h24a7.5 7.5 0 0 0 .4-15 11.5 11.5 0 0 0-21.8-2.6A9 9 0 0 0 12.5 36Z" fill="currentColor" opacity=".16" />
      <path d="M12.5 36h24a7.5 7.5 0 0 0 .4-15 11.5 11.5 0 0 0-21.8-2.6A9 9 0 0 0 12.5 36Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
