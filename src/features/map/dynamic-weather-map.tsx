"use client";

import dynamic from "next/dynamic";

import type { WeatherMapProps } from "./map-engine.types";

const WeatherMapClient = dynamic(
  () => import("./weather-map").then((module) => module.WeatherMap),
  {
    ssr: false,
    loading: () => (
      <div className="map-state map-state--loading" role="status">
        <span className="map-state__spinner" aria-hidden="true" />
        <strong>MapLibre ачаалж байна</strong>
        <p>Газрын зургийн модуль зөвхөн бүрэн горимд ачаална.</p>
      </div>
    ),
  },
);

export function DynamicWeatherMap(props: WeatherMapProps) {
  return <WeatherMapClient {...props} />;
}
