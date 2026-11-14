import { NextResponse } from "next/server";

import {
  MONGOLIA_WEATHER_BOUNDS,
  conditionToCode,
  windComponentsFromDirection,
} from "@/features/weather-data";
import type {
  WeatherCondition,
  WeatherGridPayload,
  WeatherTimeStep,
} from "@/features/weather-data";

const GRID_COLUMNS = 21;
const GRID_ROWS = 11;
const FORECAST_HOURS = 24;
const BATCH_SIZE = 60;
const MEMORY_CACHE_MS = 15 * 60 * 1_000;
const STALE_CACHE_MS = 6 * 60 * 60 * 1_000;
const OPEN_METEO_GFS_URL = "https://api.open-meteo.com/v1/gfs";
const OPEN_METEO_SOURCE_URL = "https://open-meteo.com/en/docs/gfs-api";
const HOURLY_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "snowfall",
  "weather_code",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
].join(",");

interface OpenMeteoLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly hourly: {
    readonly time: readonly number[];
    readonly temperature_2m: readonly number[];
    readonly relative_humidity_2m: readonly number[];
    readonly precipitation: readonly number[];
    readonly snowfall: readonly number[];
    readonly weather_code: readonly number[];
    readonly pressure_msl: readonly number[];
    readonly wind_speed_10m: readonly number[];
    readonly wind_direction_10m: readonly number[];
  };
}

interface GridPoint {
  readonly latitude: number;
  readonly longitude: number;
}

interface CachedPayload {
  readonly payload: WeatherGridPayload;
  readonly storedAt: number;
}

let cachedPayload: CachedPayload | undefined;
let activeRefresh: Promise<WeatherGridPayload> | undefined;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function gridPoints(): readonly GridPoint[] {
  const longitudeStep = (MONGOLIA_WEATHER_BOUNDS.east - MONGOLIA_WEATHER_BOUNDS.west) / (GRID_COLUMNS - 1);
  const latitudeStep = (MONGOLIA_WEATHER_BOUNDS.north - MONGOLIA_WEATHER_BOUNDS.south) / (GRID_ROWS - 1);
  return Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => {
    const row = Math.floor(index / GRID_COLUMNS);
    const column = index % GRID_COLUMNS;
    return {
      latitude: MONGOLIA_WEATHER_BOUNDS.south + row * latitudeStep,
      longitude: MONGOLIA_WEATHER_BOUNDS.west + column * longitudeStep,
    };
  });
}

function chunks<Value>(values: readonly Value[], size: number): readonly (readonly Value[])[] {
  const result: Value[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function fetchBatch(points: readonly GridPoint[], attempt = 0): Promise<readonly OpenMeteoLocation[]> {
  const url = new URL(OPEN_METEO_GFS_URL);
  url.searchParams.set("latitude", points.map((point) => point.latitude.toFixed(4)).join(","));
  url.searchParams.set("longitude", points.map((point) => point.longitude.toFixed(4)).join(","));
  url.searchParams.set("hourly", HOURLY_VARIABLES);
  url.searchParams.set("forecast_hours", String(FORECAST_HOURS));
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("models", "gfs_global");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 1_800 },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 429 && attempt < 3) {
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const retryDelay = Number.isFinite(retryAfterSeconds)
      ? Math.min(5_000, retryAfterSeconds * 1_000)
      : 600 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    return fetchBatch(points, attempt + 1);
  }
  if (!response.ok) throw new Error(`Open-Meteo GFS ${response.status}`);
  const body = await response.json() as OpenMeteoLocation | readonly OpenMeteoLocation[];
  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== points.length) throw new Error("Open-Meteo GFS location count mismatch");
  return locations;
}

async function fetchLocations(points: readonly GridPoint[]): Promise<readonly OpenMeteoLocation[]> {
  const batches = chunks(points, BATCH_SIZE);
  const locations: OpenMeteoLocation[] = [];
  for (const batch of batches) {
    locations.push(...await fetchBatch(batch));
  }
  return locations;
}

function finiteAt(values: readonly number[], index: number, field: string): number {
  const value = values[index];
  if (!Number.isFinite(value)) throw new Error(`Open-Meteo GFS missing ${field}[${index}]`);
  return value;
}

function conditionFor(code: number, precipitationMm: number, snowfallCm: number): WeatherCondition {
  if (snowfallCm >= 0.01 || [71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if (precipitationMm >= 0.01 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  if (code <= 1) return "clear";
  return "cloudy";
}

function formatMongoliaTime(epochSeconds: number): string {
  const local = new Date(epochSeconds * 1_000 + 8 * 60 * 60 * 1_000);
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours().toString().padStart(2, "0");
  const minute = local.getUTCMinutes().toString().padStart(2, "0");
  return `${month}-р сарын ${day} · ${hour}:${minute}`;
}

function nominalResolutionKm(): number {
  const latitude = (MONGOLIA_WEATHER_BOUNDS.south + MONGOLIA_WEATHER_BOUNDS.north) / 2;
  const longitudeKm = ((MONGOLIA_WEATHER_BOUNDS.east - MONGOLIA_WEATHER_BOUNDS.west) / (GRID_COLUMNS - 1)) * 111.32 * Math.cos(latitude * Math.PI / 180);
  const latitudeKm = ((MONGOLIA_WEATHER_BOUNDS.north - MONGOLIA_WEATHER_BOUNDS.south) / (GRID_ROWS - 1)) * 111.32;
  return Math.round((longitudeKm + latitudeKm) / 2);
}

async function buildWeatherPayload(): Promise<WeatherGridPayload> {
    const points = gridPoints();
    const locations = await fetchLocations(points);
    const time = locations[0]?.hourly.time;
    if (!time || time.length !== FORECAST_HOURS || locations.length !== points.length) {
      throw new Error("Open-Meteo GFS payload is incomplete");
    }

    const timeSteps: readonly WeatherTimeStep[] = time.map((epochSeconds, index) => Object.freeze({
      id: `gfs-${epochSeconds}`,
      index,
      validTime: new Date(epochSeconds * 1_000).toISOString(),
      offsetHours: index,
      intervalHours: 1,
      labelMn: formatMongoliaTime(epochSeconds),
    }));
    const fetchedAt = new Date().toISOString();
    const metadata = Object.freeze({
      datasetId: `open-meteo-gfs-${time[0]}`,
      title: "Монгол орны NOAA GFS урьдчилсан төлвийн дээжлэгдсэн grid",
      dataKind: "forecast" as const,
      isSynthetic: false,
      isScientificallyValidated: false,
      source: "Open-Meteo GFS API · NOAA GFS Global",
      sourceUrl: OPEN_METEO_SOURCE_URL,
      licence: "Open-Meteo API data · CC BY 4.0",
      model: "NOAA GFS Global (Open-Meteo adapter)",
      runTime: "",
      generatedAt: fetchedAt,
      validFrom: timeSteps[0]!.validTime,
      validUntil: timeSteps.at(-1)!.validTime,
      timeStepHours: 1,
      timeStepCount: timeSteps.length,
      bounds: MONGOLIA_WEATHER_BOUNDS,
      gridColumns: GRID_COLUMNS,
      gridRows: GRID_ROWS,
      nominalResolutionKm: nominalResolutionKm(),
      processingVersion: "open-meteo-gfs-grid-v1",
      units: Object.freeze({
        temperature: "°C" as const,
        wind: "m/s" as const,
        windDirection: "degrees from true north" as const,
        humidity: "%" as const,
        pressure: "hPa" as const,
        precipitation: "mm/h" as const,
        snowfall: "cm/h" as const,
      }),
      disclaimer: "Open-Meteo-оор дамжуулсан NOAA GFS урьдчилсан төлөв. Албан ёсны ЦУОШГ-ын сэрэмжлүүлэг биш; дэлгэцийн grid ойролцоогоор 120 км зайтай дээжлэгдсэн.",
    });

    const grids = timeSteps.map((timeStep, timeIndex) => {
      const temperatureC: number[] = [];
      const windUMps: number[] = [];
      const windVMps: number[] = [];
      const windSpeedMps: number[] = [];
      const windDirectionDegrees: number[] = [];
      const relativeHumidityPercent: number[] = [];
      const pressureHpa: number[] = [];
      const hourlyPrecipitationMm: number[] = [];
      const snowfallCm: number[] = [];
      const conditionCodes: number[] = [];

      for (const location of locations) {
        const temperature = finiteAt(location.hourly.temperature_2m, timeIndex, "temperature_2m");
        const humidity = finiteAt(location.hourly.relative_humidity_2m, timeIndex, "relative_humidity_2m");
        const precipitation = finiteAt(location.hourly.precipitation, timeIndex, "precipitation");
        const snowfall = finiteAt(location.hourly.snowfall, timeIndex, "snowfall");
        const weatherCode = finiteAt(location.hourly.weather_code, timeIndex, "weather_code");
        const pressure = finiteAt(location.hourly.pressure_msl, timeIndex, "pressure_msl");
        const windSpeed = finiteAt(location.hourly.wind_speed_10m, timeIndex, "wind_speed_10m");
        const windDirection = finiteAt(location.hourly.wind_direction_10m, timeIndex, "wind_direction_10m");
        const components = windComponentsFromDirection(windDirection, windSpeed);

        temperatureC.push(round(temperature));
        windUMps.push(round(components.u));
        windVMps.push(round(components.v));
        windSpeedMps.push(round(windSpeed));
        windDirectionDegrees.push(round(windDirection, 1));
        relativeHumidityPercent.push(round(humidity, 1));
        pressureHpa.push(round(pressure, 1));
        hourlyPrecipitationMm.push(round(precipitation));
        snowfallCm.push(round(snowfall));
        conditionCodes.push(conditionToCode(conditionFor(weatherCode, precipitation, snowfall)));
      }

      return Object.freeze({
        timeStep,
        fields: Object.freeze({
          temperatureC,
          windUMps,
          windVMps,
          windSpeedMps,
          windDirectionDegrees,
          relativeHumidityPercent,
          pressureHpa,
          hourlyPrecipitationMm,
          snowfallCm,
          conditionCodes,
        }),
      });
    });

    return Object.freeze({ metadata, timeSteps, grids });
}

async function resolveWeatherPayload(): Promise<WeatherGridPayload> {
  const now = Date.now();
  if (cachedPayload && now - cachedPayload.storedAt < MEMORY_CACHE_MS) {
    return cachedPayload.payload;
  }
  if (activeRefresh) return activeRefresh;

  activeRefresh = buildWeatherPayload()
    .then((payload) => {
      cachedPayload = { payload, storedAt: Date.now() };
      return payload;
    })
    .finally(() => {
      activeRefresh = undefined;
    });
  return activeRefresh;
}

export async function GET() {
  try {
    const payload = await resolveWeatherPayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    console.error("Open-Meteo grid fetch failed", error);
    if (cachedPayload && Date.now() - cachedPayload.storedAt < STALE_CACHE_MS) {
      return NextResponse.json(cachedPayload.payload, {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
          Warning: '110 - "Open-Meteo refresh failed; serving a recent cached grid"',
        },
      });
    }
    return NextResponse.json(
      { error: "Open-Meteo GFS урьдчилсан төлвийг одоогоор татаж чадсангүй." },
      { status: 502, headers: { "Cache-Control": "public, max-age=60" } },
    );
  }
}
