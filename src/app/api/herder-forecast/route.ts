import { NextResponse } from "next/server";

import {
  DIRECTION_META,
  directionalCoordinates,
  summarizeDirection,
} from "@/features/herder-mode/forecast-utils";
import type {
  HerderCurrentWeather,
  HerderForecastPayload,
  HerderHourlyWeather,
} from "@/features/herder-mode/types";

interface OpenMeteoResponse {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevation: number;
  readonly timezone: string;
  readonly timezone_abbreviation: string;
  readonly current: {
    readonly time: number;
    readonly temperature_2m: number;
    readonly apparent_temperature: number;
    readonly precipitation: number;
    readonly weather_code: number;
    readonly wind_speed_10m: number;
    readonly wind_direction_10m: number;
    readonly wind_gusts_10m: number;
  };
  readonly hourly: {
    readonly time: readonly number[];
    readonly temperature_2m: readonly number[];
    readonly apparent_temperature: readonly number[];
    readonly precipitation_probability: readonly number[];
    readonly precipitation: readonly number[];
    readonly snowfall: readonly number[];
    readonly weather_code: readonly number[];
    readonly wind_speed_10m: readonly number[];
    readonly wind_direction_10m: readonly number[];
    readonly wind_gusts_10m: readonly number[];
    readonly visibility: readonly number[];
  };
}

function numberAt(values: readonly number[], index: number): number {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

function currentWeather(source: OpenMeteoResponse): HerderCurrentWeather {
  return Object.freeze({
    time: toIso(source.current.time),
    temperatureC: source.current.temperature_2m,
    apparentTemperatureC: source.current.apparent_temperature,
    precipitationMm: source.current.precipitation,
    weatherCode: source.current.weather_code,
    windSpeedMps: source.current.wind_speed_10m,
    windDirectionDegrees: source.current.wind_direction_10m,
    windGustMps: source.current.wind_gusts_10m,
  });
}

function hourlyWeather(source: OpenMeteoResponse): readonly HerderHourlyWeather[] {
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

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const latitude = parseCoordinate(requestUrl.searchParams.get("lat"), -90, 90);
  const longitude = parseCoordinate(requestUrl.searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "Байршлын өргөрөг, уртраг хүчинтэй биш байна." },
      { status: 400 },
    );
  }

  const origin = Object.freeze({ latitude, longitude });
  const directionPoints = directionalCoordinates(origin);
  const points = [origin, ...directionPoints];
  const providerUrl = new URL("https://api.open-meteo.com/v1/forecast");
  providerUrl.searchParams.set("latitude", points.map((point) => point.latitude.toFixed(5)).join(","));
  providerUrl.searchParams.set("longitude", points.map((point) => point.longitude.toFixed(5)).join(","));
  providerUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  );
  providerUrl.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
  );
  providerUrl.searchParams.set("forecast_hours", "36");
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
    const sources = await response.json() as OpenMeteoResponse[];
    if (!Array.isArray(sources) || sources.length !== points.length) {
      throw new Error("Open-Meteo response shape");
    }

    const center = sources[0]!;
    const hourly = hourlyWeather(center);
    const directions = DIRECTION_META.map((meta, index) => {
      const source = sources[index + 1]!;
      return summarizeDirection(
        meta.id,
        directionPoints[index]!,
        hourlyWeather(source).slice(0, 12),
      );
    });

    const payload: HerderForecastPayload = Object.freeze({
      fetchedAt: new Date().toISOString(),
      timezone: center.timezone,
      timezoneAbbreviation: center.timezone_abbreviation,
      elevationM: center.elevation,
      location: origin,
      current: currentWeather(center),
      hourly,
      directions: Object.freeze(directions),
      source: Object.freeze({
        name: "Open-Meteo",
        url: "https://open-meteo.com/en/docs",
        model: "Best Match олон загварын урьдчилсан төлөв",
      }),
      limitationsMn: Object.freeze([
        "Албан ёсны ЦУОШГ-ын сэрэмжлүүлгийн суваг холбогдоогүй.",
        "Чиглэлийн харьцуулалт нь 12 км зай дахь дараагийн 12 цагийн цаг агаарыг л харьцуулна.",
        "Бэлчээрийн өвс, ус, цасны зузаан, мөс, зам ба газрын бартааг үнэлээгүй.",
      ]),
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Herder forecast fetch failed", error);
    return NextResponse.json(
      { error: "Цаг агаарын бодит төлөвийг одоогоор татаж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу." },
      { status: 502 },
    );
  }
}
