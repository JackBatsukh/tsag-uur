/**
 * Shared weather-domain contracts.
 *
 * Providers expose an already-loaded, synchronous snapshot so render loops can
 * sample a vector field without awaiting network work. A future remote provider
 * should fetch/validate its payload before it is passed to map components.
 */

export type WeatherDataKind =
  | "synthetic"
  | "forecast"
  | "observation"
  | "historical-model";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "dusty";

export type WindDirectionCardinal =
  | "N"
  | "NNE"
  | "NE"
  | "ENE"
  | "E"
  | "ESE"
  | "SE"
  | "SSE"
  | "S"
  | "SSW"
  | "SW"
  | "WSW"
  | "W"
  | "WNW"
  | "NW"
  | "NNW";

export type WeatherLayerId =
  | "temperature"
  | "wind-speed"
  | "precipitation"
  | "humidity"
  | "pressure";

export type WeatherGridFieldKey =
  | "temperatureC"
  | "windSpeedMps"
  | "hourlyPrecipitationMm"
  | "relativeHumidityPercent"
  | "pressureHpa";

export type WeatherUserMode =
  | "citizen"
  | "herder"
  | "agriculture"
  | "researcher";

export interface WeatherCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface WeatherBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface WeatherUnits {
  readonly temperature: "°C";
  readonly wind: "m/s";
  readonly windDirection: "degrees from true north";
  readonly humidity: "%";
  readonly pressure: "hPa";
  readonly precipitation: "mm/h";
}

export interface WeatherMetadata {
  readonly datasetId: string;
  readonly title: string;
  readonly dataKind: WeatherDataKind;
  readonly isSynthetic: boolean;
  readonly isScientificallyValidated: boolean;
  readonly source: string;
  readonly model: string;
  readonly runTime: string;
  readonly generatedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly timeStepHours: number;
  readonly timeStepCount: number;
  readonly bounds: WeatherBounds;
  readonly gridColumns: number;
  readonly gridRows: number;
  readonly nominalResolutionKm: number;
  readonly processingVersion: string;
  readonly units: WeatherUnits;
  readonly disclaimer: string;
}

export interface WeatherTimeStep {
  readonly id: string;
  readonly index: number;
  readonly validTime: string;
  readonly offsetHours: number;
  readonly intervalHours: number;
  readonly labelMn: string;
}

export interface WeatherSample {
  readonly coordinates: WeatherCoordinates;
  readonly timeStepId: string;
  readonly validTime: string;
  readonly temperatureC: number;
  readonly windUMps: number;
  readonly windVMps: number;
  readonly windSpeedMps: number;
  /** Meteorological direction: where the wind comes from, clockwise from north. */
  readonly windDirectionDegrees: number;
  readonly windDirectionCardinal: WindDirectionCardinal;
  readonly relativeHumidityPercent: number;
  /** Synthetic mean sea-level pressure, not station/surface pressure. */
  readonly pressureHpa: number;
  readonly hourlyPrecipitationMm: number;
  readonly condition: WeatherCondition;
}

/** Compact row-major fields. Rows progress south to north. */
export interface WeatherGridFields {
  readonly temperatureC: Float32Array;
  readonly windUMps: Float32Array;
  readonly windVMps: Float32Array;
  readonly windSpeedMps: Float32Array;
  readonly windDirectionDegrees: Float32Array;
  readonly relativeHumidityPercent: Float32Array;
  readonly pressureHpa: Float32Array;
  readonly hourlyPrecipitationMm: Float32Array;
  readonly conditionCodes: Uint8Array;
}

export interface WeatherGrid {
  readonly metadata: WeatherMetadata;
  readonly timeStep: WeatherTimeStep;
  readonly bounds: WeatherBounds;
  readonly columns: number;
  readonly rows: number;
  readonly longitudeStep: number;
  readonly latitudeStep: number;
  readonly fields: WeatherGridFields;
}

export interface WeatherPointForecast {
  readonly location: WeatherCoordinates;
  readonly metadata: WeatherMetadata;
  readonly steps: readonly WeatherSample[];
}

export type WeatherTimeSelector = number | string | WeatherTimeStep;

export interface WeatherColorStop {
  readonly value: number;
  readonly color: `#${string}`;
}

export interface WeatherLayerDefinition {
  readonly id: WeatherLayerId;
  readonly labelMn: string;
  readonly shortLabelMn: string;
  readonly field: WeatherGridFieldKey;
  readonly unit: string;
  readonly valueRange: readonly [number, number];
  readonly colorStops: readonly WeatherColorStop[];
}

export interface WeatherModeDefinition {
  readonly id: WeatherUserMode;
  readonly labelMn: string;
  readonly available: boolean;
}

/**
 * Read-only weather snapshot consumed by maps, timelines and point panels.
 * All sampling methods are synchronous by design for Canvas/WebGL render loops.
 */
export interface WeatherDataProvider {
  readonly id: string;
  readonly metadata: WeatherMetadata;
  readonly timeSteps: readonly WeatherTimeStep[];
  contains(latitude: number, longitude: number): boolean;
  getGrid(time: WeatherTimeSelector): WeatherGrid;
  sample(
    latitude: number,
    longitude: number,
    time: WeatherTimeSelector,
  ): WeatherSample | null;
  getPointForecast(
    latitude: number,
    longitude: number,
  ): WeatherPointForecast | null;
}

