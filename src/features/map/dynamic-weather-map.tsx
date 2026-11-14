"use client";

import dynamic from "next/dynamic";

import type { WeatherMapProps } from "./map-engine.types";

const WeatherMapClient = dynamic(
  () => import("./weather-map").then((module) => module.WeatherMap),
  {
    ssr: false,
    loading: () => (
      <div className="map-state map-state--loading" role="status" aria-label="MapLibre газрын зураг ачаалж байна">
        <span className="map-state__spinner" aria-hidden="true" />
        <span className="sr-only">MapLibre газрын зураг ачаалж байна</span>
      </div>
    ),
  },
);

export function DynamicWeatherMap(props: WeatherMapProps) {
  return <WeatherMapClient {...props} />;
}
