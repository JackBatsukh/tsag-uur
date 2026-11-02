import { NextResponse } from "next/server";

import { analyzeLivestockWeather } from "@/features/herder-mode/forecast-utils";
import type {
  HerderHourlyWeather,
  LivestockSearchPayload,
} from "@/features/herder-mode/types";

interface OpenMeteoHistoryResponse {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly hourly: {
    readonly time: readonly number[];
    readonly temperature_2m: readonly (number | null)[];
    readonly apparent_temperature: readonly (number | null)[];
    readonly precipitation: readonly (number | null)[];
    readonly precipitation_probability: readonly (number | null)[];
    readonly snowfall: readonly (number | null)[];
    readonly weather_code: readonly (number | null)[];
    readonly wind_speed_10m: readonly (number | null)[];
    readonly wind_direction_10m: readonly (number | null)[];
    readonly wind_gusts_10m: readonly (number | null)[];
    readonly visibility: readonly (number | null)[];
  };
}

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function numberAt(values: readonly (number | null)[], index: number): number {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

function hourlyWeather(source: OpenMeteoHistoryResponse): readonly HerderHourlyWeather[] {
  return Object.freeze(source.hourly.time.map((time, index) => Object.freeze({
    time: toIso(time),
    temperatureC: numberAt(source.hourly.temperature_2m, index),
    apparentTemperatureC: numberAt(source.hourly.apparent_temperature, index),
    precipitationProbabilityPercent: numberAt(source.hourly.precipitation_probability, index),
    precipitationMm: numberAt(source.hourly.precipitation, index),
    snowfallCm: numberAt(source.hourly.snowfall, index),
    weatherCode: numberAt(source.hourly.weather_code, index),
    windSpeedMps: numberAt(source.hourly.wind_speed_10m, index),
    windDirectionDegrees: numberAt(source.hourly.wind_direction_10m, index),
    windGustMps: numberAt(source.hourly.wind_gusts_10m, index),
    visibilityM: numberAt(source.hourly.visibility, index),
  })));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const latitude = parseCoordinate(requestUrl.searchParams.get("lat"), -90, 90);
  const longitude = parseCoordinate(requestUrl.searchParams.get("lon"), -180, 180);
  const lastSeenValue = requestUrl.searchParams.get("lastSeen");
  const lastSeenMs = lastSeenValue ? Date.parse(lastSeenValue) : Number.NaN;
  const nowMs = Date.now();
  const earliestAllowed = nowMs - 7 * 24 * 60 * 60 * 1000;

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Сүүлд харсан газрын координат хүчинтэй биш байна." }, { status: 400 });
  }
  if (!Number.isFinite(lastSeenMs) || lastSeenMs < earliestAllowed || lastSeenMs > nowMs + 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Сүүлд харсан цагийг одооноос өмнөх 7 хоногийн дотор сонгоно уу." },
      { status: 400 },
    );
  }

  const providerUrl = new URL("https://api.open-meteo.com/v1/forecast");
  providerUrl.searchParams.set("latitude", latitude.toFixed(5));
  providerUrl.searchParams.set("longitude", longitude.toFixed(5));
  providerUrl.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
  );
  providerUrl.searchParams.set("past_hours", "168");
  providerUrl.searchParams.set("forecast_hours", "1");
  providerUrl.searchParams.set("timezone", "auto");
  providerUrl.searchParams.set("timeformat", "unixtime");
  providerUrl.searchParams.set("wind_speed_unit", "ms");

  try {
    const response = await fetch(providerUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const source = await response.json() as OpenMeteoHistoryResponse;
    const hours = hourlyWeather(source).filter((hour) => {
      const time = Date.parse(hour.time);
      return time >= lastSeenMs && time <= nowMs + 60 * 60 * 1000;
    });
    const analysis = analyzeLivestockWeather(hours);
    if (!analysis) {
      return NextResponse.json(
        { error: "Сонгосон хугацааны цаг агаарын архив олдсонгүй." },
        { status: 404 },
      );
    }

    const payload: LivestockSearchPayload = Object.freeze({
      fetchedAt: new Date().toISOString(),
      timezone: source.timezone,
      location: Object.freeze({ latitude, longitude }),
      hourly: hours,
      analysis,
      source: Object.freeze({
        name: "Open-Meteo",
        url: "https://open-meteo.com/en/docs",
        model: "Best Match · сүүлийн 7 хоногийн архивлагдсан загварын цагийн мэдээлэл",
      }),
      limitationsMn: Object.freeze([
        "Энэ нь GPS мөр эсвэл малын хөдөлгөөний баталгаажсан загвар биш.",
        "Салхи нь нөлөөлөх нэг хүчин зүйл; газрын бартаа, хашаа, жалга, ус, цасны зузааны давхарга холбогдоогүй.",
        "Өнгөрсөн цагийн утга нь цаг уурын станцын цэгэн хэмжилт биш, архивлагдсан цаг агаарын загварын мэдээлэл.",
        "Хайлтын дээд зайг малчин өөрийн нутгийн мэдлэгээр оруулна; систем малын явсан зайг таахгүй.",
      ]),
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Livestock history fetch failed", error);
    return NextResponse.json(
      { error: "Өнгөрсөн цаг агаарын мэдээлэл татаж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу." },
      { status: 502 },
    );
  }
}
