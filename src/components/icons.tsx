import type { SVGProps } from "react";

import type { WeatherSymbol } from "@/types/weather";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

const sharedProps = {
  "aria-hidden": true,
  focusable: false,
} as const;

export function BrandMark(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" {...sharedProps} {...props}>
      <circle cx="20" cy="20" r="17.5" stroke="currentColor" />
      <path
        d="M9 21.5c3.4-6.7 8.2-10 14.4-10 2.8 0 5.3.7 7.6 2.1-2.5 1.2-4.5 2.9-6 5.2-1.5 2.2-2.3 4.8-2.3 7.7 0 .7.1 1.4.2 2.1-6.1.5-10.7-1.9-13.9-7.1Z"
        fill="currentColor"
        opacity=".16"
      />
      <path
        d="M9 21.5c3.4-6.7 8.2-10 14.4-10 2.8 0 5.3.7 7.6 2.1-2.5 1.2-4.5 2.9-6 5.2-1.5 2.2-2.3 4.8-2.3 7.7 0 .7.1 1.4.2 2.1-6.1.5-10.7-1.9-13.9-7.1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <path
        d="M20 10c0 5-5.3 9.1-7.3 10.5a1.2 1.2 0 0 1-1.4 0C9.3 19.1 4 15 4 10a8 8 0 1 1 16 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function WindIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <path d="M3 8h10.5a2.5 2.5 0 1 0-2.2-3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 12h15a2.5 2.5 0 1 1-2.2 3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <path d="M12 3.5S6.5 9.7 6.5 14a5.5 5.5 0 1 0 11 0C17.5 9.7 12 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 15.2c.4 1.3 1.2 2 2.5 2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function HumidityIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <path d="M7 4v4M4 6h6M17 16v4M14 18h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.2 3.8s-3.7 4.3-3.7 7.2a3.7 3.7 0 0 0 7.4 0c0-2.9-3.7-7.2-3.7-7.2Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <path d="M12 3 5 6v5.3c0 4.5 2.8 7.8 7 9.7 4.2-1.9 7-5.2 7-9.7V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9.2 12 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.5V16M12 7.5h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...sharedProps} {...props}>
      <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
