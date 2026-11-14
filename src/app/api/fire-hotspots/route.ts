import { NextResponse } from "next/server";

import { normalizeFirmsCsv } from "@/features/herder-mode/safety";
import type { FireHotspotPayload } from "@/features/herder-mode/types";

const FIRMS_DOCS = "https://firms.modaps.eosdis.nasa.gov/api/area/";
const MONGOLIA_BOUNDING_BOX = "87.5,41.5,120,52.5";
const PRODUCT = "VIIRS_SNPP_NRT";

export async function GET() {
  const mapKey = process.env.NASA_FIRMS_MAP_KEY?.trim();
  const base = {
    fetchedAt: new Date().toISOString(),
    source: {
      name: "NASA FIRMS" as const,
      url: FIRMS_DOCS,
      product: PRODUCT,
      provenance: "satellite" as const,
    },
  };

  if (!mapKey) {
    const payload: FireHotspotPayload = {
      ...base,
      configured: false,
      hotspots: [],
      messageMn: "NASA FIRMS MAP_KEY тохируулаагүй. Хуурамч түймрийн цэг харуулахгүй.",
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  }

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/${PRODUCT}/${MONGOLIA_BOUNDING_BOX}/1`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/csv" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`NASA FIRMS ${response.status}`);
    const hotspots = normalizeFirmsCsv(await response.text());
    const payload: FireHotspotPayload = {
      ...base,
      configured: true,
      hotspots,
      messageMn: hotspots.length
        ? "Эдгээр нь хиймэл дагуулын дулааны цэг бөгөөд албан ёсоор батлагдсан түймрийн хил биш."
        : "Сүүлийн нэг хоногт сонгосон бүтээгдэхүүнээс Монголыг хамарсан тэгш өнцөгт бүсэд дулааны цэг ирсэнгүй.",
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    console.error("NASA FIRMS fetch failed", error);
    return NextResponse.json(
      { ...base, configured: true, hotspots: [], messageMn: "NASA FIRMS мэдээллийг одоогоор татаж чадсангүй." } satisfies FireHotspotPayload,
      { status: 502, headers: { "Cache-Control": "public, max-age=60" } },
    );
  }
}
