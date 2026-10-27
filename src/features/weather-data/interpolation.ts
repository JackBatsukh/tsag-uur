import { WEATHER_CONDITION_CODE } from "./constants.ts";
import type {
  WeatherBounds,
  WeatherCondition,
  WeatherGrid,
  WeatherGridFieldKey,
  WeatherSample,
  WindDirectionCardinal,
} from "./types";

const CARDINAL_DIRECTIONS: readonly WindDirectionCardinal[] = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export interface WeatherConditionInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly temperatureC: number;
  readonly windSpeedMps: number;
  readonly relativeHumidityPercent: number;
  readonly hourlyPrecipitationMm: number;
}

export function containsCoordinates(
  bounds: WeatherBounds,
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

export function windDirectionFromComponents(
  windUMps: number,
  windVMps: number,
): number {
  if (Math.abs(windUMps) < 1e-9 && Math.abs(windVMps) < 1e-9) {
    return 0;
  }

  // U is eastward and V is northward. Meteorological direction describes the
  // origin of the wind, clockwise from true north.
  return ((Math.atan2(-windUMps, -windVMps) * 180) / Math.PI + 360) % 360;
}

/** Convert meteorological "from" direction and speed to eastward/northward U/V. */
export function windComponentsFromDirection(
  directionDegrees: number,
  speedMps: number,
): Readonly<{ u: number; v: number }> {
  if (!Number.isFinite(directionDegrees) || !Number.isFinite(speedMps)) {
    throw new TypeError("Wind direction and speed must be finite numbers.");
  }
  if (speedMps < 0) {
    throw new RangeError("Wind speed cannot be negative.");
  }
  const radians = (((directionDegrees % 360) + 360) % 360) * (Math.PI / 180);
  return Object.freeze({
    u: -speedMps * Math.sin(radians),
    v: -speedMps * Math.cos(radians),
  });
}

export function cardinalFromDegrees(
  directionDegrees: number,
): WindDirectionCardinal {
  const normalized = ((directionDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[index] ?? "N";
}

export function resolveWeatherCondition({
  latitude,
  longitude,
  temperatureC,
  windSpeedMps,
  relativeHumidityPercent,
  hourlyPrecipitationMm,
}: WeatherConditionInput): WeatherCondition {
  if (hourlyPrecipitationMm >= 0.08) {
    return temperatureC <= 0.8 ? "snow" : "rain";
  }

  const isGobiDustRegion =
    latitude < 45.8 && longitude > 97 && longitude < 113.5;
  if (
    isGobiDustRegion &&
    relativeHumidityPercent < 34 &&
    windSpeedMps >= 7
  ) {
    return "dusty";
  }

  if (relativeHumidityPercent >= 64 || hourlyPrecipitationMm >= 0.025) {
    return "cloudy";
  }

  return "clear";
}

export function conditionToCode(condition: WeatherCondition): number {
  return WEATHER_CONDITION_CODE[condition];
}

export function getWeatherGridField(
  grid: WeatherGrid,
  field: WeatherGridFieldKey,
): Float32Array {
  return grid.fields[field];
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function bilinearValue(
  values: Float32Array,
  columns: number,
  row0: number,
  row1: number,
  column0: number,
  column1: number,
  xAmount: number,
  yAmount: number,
): number {
  const southwest = values[row0 * columns + column0] ?? 0;
  const southeast = values[row0 * columns + column1] ?? southwest;
  const northwest = values[row1 * columns + column0] ?? southwest;
  const northeast = values[row1 * columns + column1] ?? northwest;
  return lerp(
    lerp(southwest, southeast, xAmount),
    lerp(northwest, northeast, xAmount),
    yAmount,
  );
}

/** Bilinearly interpolate the numeric fields at a geographic point. */
export function sampleWeatherGrid(
  grid: WeatherGrid,
  latitude: number,
  longitude: number,
): WeatherSample | null {
  if (!containsCoordinates(grid.bounds, latitude, longitude)) {
    return null;
  }

  const fractionalColumn =
    (longitude - grid.bounds.west) / grid.longitudeStep;
  const fractionalRow = (latitude - grid.bounds.south) / grid.latitudeStep;
  const column0 = Math.min(
    grid.columns - 1,
    Math.max(0, Math.floor(fractionalColumn)),
  );
  const row0 = Math.min(
    grid.rows - 1,
    Math.max(0, Math.floor(fractionalRow)),
  );
  const column1 = Math.min(grid.columns - 1, column0 + 1);
  const row1 = Math.min(grid.rows - 1, row0 + 1);
  const xAmount = Math.min(1, Math.max(0, fractionalColumn - column0));
  const yAmount = Math.min(1, Math.max(0, fractionalRow - row0));
  const interpolate = (values: Float32Array): number =>
    bilinearValue(
      values,
      grid.columns,
      row0,
      row1,
      column0,
      column1,
      xAmount,
      yAmount,
    );

  const temperatureC = interpolate(grid.fields.temperatureC);
  const windUMps = interpolate(grid.fields.windUMps);
  const windVMps = interpolate(grid.fields.windVMps);
  const windSpeedMps = Math.hypot(windUMps, windVMps);
  const windDirectionDegrees = windDirectionFromComponents(windUMps, windVMps);
  const relativeHumidityPercent = interpolate(
    grid.fields.relativeHumidityPercent,
  );
  const pressureHpa = interpolate(grid.fields.pressureHpa);
  const hourlyPrecipitationMm = interpolate(
    grid.fields.hourlyPrecipitationMm,
  );
  const condition = resolveWeatherCondition({
    latitude,
    longitude,
    temperatureC,
    windSpeedMps,
    relativeHumidityPercent,
    hourlyPrecipitationMm,
  });

  return {
    coordinates: { latitude, longitude },
    timeStepId: grid.timeStep.id,
    validTime: grid.timeStep.validTime,
    temperatureC,
    windUMps,
    windVMps,
    windSpeedMps,
    windDirectionDegrees,
    windDirectionCardinal: cardinalFromDegrees(windDirectionDegrees),
    relativeHumidityPercent,
    pressureHpa,
    hourlyPrecipitationMm,
    condition,
  };
}

