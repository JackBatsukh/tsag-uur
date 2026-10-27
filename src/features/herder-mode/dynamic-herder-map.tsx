"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";
import type { HerderMap } from "./herder-map";

const HerderMapClient = dynamic(
  () => import("./herder-map").then((module) => module.HerderMap),
  {
    ssr: false,
    loading: () => (
      <div className="herder-map herder-map__state" role="status">
        <strong>MapLibre ачаалж байна…</strong>
      </div>
    ),
  },
);

export function DynamicHerderMap(props: ComponentProps<typeof HerderMap>) {
  return <HerderMapClient {...props} />;
}
