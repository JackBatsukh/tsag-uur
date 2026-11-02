"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { LivestockSearchMap } from "./livestock-search-map";

const LivestockSearchMapClient = dynamic(
  () => import("./livestock-search-map").then((module) => module.LivestockSearchMap),
  {
    ssr: false,
    loading: () => <div className="livestock-search-map livestock-search-map__status">Газрын зураг ачаалж байна…</div>,
  },
);

export function DynamicLivestockSearchMap(props: ComponentProps<typeof LivestockSearchMap>) {
  return <LivestockSearchMapClient {...props} />;
}
