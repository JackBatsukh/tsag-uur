import {
  MONGOLIA_WEATHER_BOUNDS,
  SYNTHETIC_WEATHER_UNITS,
} from "./constants";
import {
  conditionToCode,
  containsCoordinates,
  resolveWeatherCondition,
  sampleWeatherGrid,
  windDirectionFromComponents,
} from "./interpolation";
import type {
  WeatherBounds,
  WeatherDataProvider,
  WeatherGrid,
  WeatherGridFields,
  WeatherMetadata,
  WeatherPointForecast,
  WeatherSample,
  WeatherTimeSelector,
  WeatherTimeStep,
} from "./types";

const DEFAULT_START_TIME = "2026-10-18T12:00:00.000Z";
const DEFAULT_RUN_TIME = "2026-10-18T09:00:00.000Z";
const DEFAULT_GENERATED_AT = "2026-10-18T11:30:00.000Z";
const DEFAULT_GRID_COLUMNS = 113;
const DEFAULT_GRID_ROWS = 49;
const DEFAULT_TIME_STEP_COUNT = 24;
const DEFAULT_TIME_STEP_HOURS = 1;
const MONGOLIA_TIME_OFFSET_HOURS = 8;
const TAU = Math.PI * 2;

export interface SyntheticWeatherProviderOptions {
  readonly bounds?: WeatherBounds;
  readonly columns?: number;
  readonly rows?: number;
  readonly startTime?: string;
  readonly timeStepCount?: number;
  readonly timeStepHours?: number;
}

interface SyntheticFields {
  readonly temperatureC: number;
  readonly windUMps: number;
  readonly windVMps: number;
  readonly relativeHumidityPercent: number;
  readonly pressureHpa: number;
  readonly hourlyPrecipitationMm: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function gaussian(
  longitude: number,
  latitude: number,
  centerLongitude: number,
  centerLatitude: number,
  longitudeRadius: number,
  latitudeRadius: number,
): number {
  const x = (longitude - centerLongitude) / longitudeRadius;
  const y = (latitude - centerLatitude) / latitudeRadius;
  return Math.exp(-(x * x + y * y));
}

function validateInteger(
  value: number,
  minimum: number,
  name: string,
): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function parseIsoTime(value: string, name: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`${name} must be a valid ISO 8601 timestamp.`);
  }
  return milliseconds;
}

function formatMongolianTimeLabel(utcMilliseconds: number): string {
  const local = new Date(
    utcMilliseconds + MONGOLIA_TIME_OFFSET_HOURS * 60 * 60 * 1000,
  );
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours().toString().padStart(2, "0");
  const minute = local.getUTCMinutes().toString().padStart(2, "0");
  return `${month}-р сарын ${day} · ${hour}:${minute}`;
}

function createTimeSteps(
  startTime: string,
  count: number,
  intervalHours: number,
): readonly WeatherTimeStep[] {
  const startMilliseconds = parseIsoTime(startTime, "startTime");
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const offsetHours = index * intervalHours;
      const validMilliseconds =
        startMilliseconds + offsetHours * 60 * 60 * 1000;
      return Object.freeze({
        id: `synthetic-t${index.toString().padStart(2, "0")}`,
        index,
        validTime: new Date(validMilliseconds).toISOString(),
        offsetHours,
        intervalHours,
        labelMn: formatMongolianTimeLabel(validMilliseconds),
      });
    }),
  );
}

function nominalResolutionKm(
  bounds: WeatherBounds,
  columns: number,
  rows: number,
): number {
  const midLatitudeRadians = ((bounds.south + bounds.north) / 2) * (Math.PI / 180);
  const longitudeKm =
    ((bounds.east - bounds.west) / (columns - 1)) *
    111.32 *
    Math.cos(midLatitudeRadians);
  const latitudeKm =
    ((bounds.north - bounds.south) / (rows - 1)) * 111.32;
  return Math.round((longitudeKm + latitudeKm) / 2);
}

function syntheticElevationMeters(
  latitude: number,
  longitude: number,
): number {
  const altai = gaussian(longitude, latitude, 90.6, 48.3, 3.8, 2.7);
  const khangai = gaussian(longitude, latitude, 99.6, 47.2, 4.5, 2.2);
  const khentii = gaussian(longitude, latitude, 108.5, 48.4, 3.7, 2.2);
  const gobiBasin = gaussian(longitude, latitude, 105.5, 43.2, 7.5, 2.1);
  return 980 + 1_450 * altai + 880 * khangai + 500 * khentii - 250 * gobiBasin;
}

/**
 * Analytic, continuous fields used only for product development. They loosely
 * resemble autumn gradients, but are not fitted to observations or a model.
 */
function calculateSyntheticFields(
  latitude: number,
  longitude: number,
  offsetHours: number,
  startUtcHour: number,
): SyntheticFields {
  const elevationMeters = syntheticElevationMeters(latitude, longitude);
  const solarHour =
    (startUtcHour + offsetHours + longitude / 15 + 24 * 4) % 24;
  const diurnalTemperature =
    4.6 * Math.cos((TAU * (solarHour - 14)) / 24);
  const synopticTemperature =
    2.1 * Math.sin((longitude - 98) * 0.18 - offsetHours * 0.09) +
    1.2 * Math.cos((latitude - 46) * 0.55 + offsetHours * 0.055);
  const temperatureC = clamp(
    7.8 -
      (latitude - 42) * 1.03 -
      (elevationMeters - 950) * 0.003 +
      diurnalTemperature +
      synopticTemperature,
    -26,
    18,
  );

  const systemLongitude = 96 + offsetHours * 0.43;
  const systemLatitude = 48.2 + 0.45 * Math.sin(offsetHours * 0.12);
  const lowPressureCore = gaussian(
    longitude,
    latitude,
    systemLongitude,
    systemLatitude,
    5.4,
    2.6,
  );
  const secondaryMoisture = gaussian(
    longitude,
    latitude,
    113 - offsetHours * 0.18,
    46.8,
    4.8,
    2.1,
  );
  const scaledDx =
    ((longitude - systemLongitude) * Math.cos((latitude * Math.PI) / 180)) /
    4.2;
  const scaledDy = (latitude - systemLatitude) / 2.6;
  const rotationalStrength = 3.4 * lowPressureCore;
  const windUMps = clamp(
    4.1 +
      1.8 * Math.sin((latitude - 43) * 0.52 + offsetHours * 0.11) +
      1.25 * Math.cos((longitude - 103) * 0.22 - offsetHours * 0.08) -
      scaledDy * rotationalStrength,
    -14,
    14,
  );
  const windVMps = clamp(
    0.7 +
      1.5 * Math.cos((longitude - 101) * 0.2 + offsetHours * 0.1) +
      0.85 * Math.sin((latitude - 47) * 0.7 - offsetHours * 0.06) +
      scaledDx * rotationalStrength,
    -14,
    14,
  );

  const gobiDryness = gaussian(longitude, latitude, 105.5, 43.4, 8.2, 2.4);
  const moistureWave =
    7 * Math.sin((longitude - 91) * 0.16 - offsetHours * 0.07) +
    4 * Math.cos((latitude - 46) * 0.65);
  const relativeHumidityPercent = clamp(
    39 +
      (latitude - 42) * 2.15 +
      37 * lowPressureCore +
      16 * secondaryMoisture -
      20 * gobiDryness +
      moistureWave,
    16,
    96,
  );

  const precipitationPulse = 0.82 + 0.18 * Math.cos(offsetHours * 0.52);
  const rawPrecipitation =
    2.8 * lowPressureCore * precipitationPulse +
    1.25 * secondaryMoisture -
    0.68;
  const hourlyPrecipitationMm = clamp(rawPrecipitation, 0, 3.6);

  const pressureWave =
    3.8 * Math.cos((longitude - 104) * 0.14 + offsetHours * 0.045) +
    2.2 * Math.sin((latitude - 46) * 0.55);
  const pressureHpa = clamp(
    1017.5 - 17.5 * lowPressureCore - 5 * secondaryMoisture + pressureWave,
    990,
    1033,
  );

  return {
    temperatureC,
    windUMps,
    windVMps,
    relativeHumidityPercent,
    pressureHpa,
    hourlyPrecipitationMm,
  };
}

export class SyntheticWeatherProvider implements WeatherDataProvider {
  readonly id = "tsag-uur-synthetic-v1";
  readonly metadata: WeatherMetadata;
  readonly timeSteps: readonly WeatherTimeStep[];

  readonly #gridCache = new Map<number, WeatherGrid>();
  readonly #startUtcHour: number;

  constructor(options: SyntheticWeatherProviderOptions = {}) {
    const bounds = Object.freeze({
      ...(options.bounds ?? MONGOLIA_WEATHER_BOUNDS),
    });
    if (
      bounds.west >= bounds.east ||
      bounds.south >= bounds.north ||
      bounds.south < -90 ||
      bounds.north > 90 ||
      bounds.west < -180 ||
      bounds.east > 180
    ) {
      throw new RangeError("bounds must be a valid latitude/longitude extent.");
    }

    const columns = validateInteger(
      options.columns ?? DEFAULT_GRID_COLUMNS,
      2,
      "columns",
    );
    const rows = validateInteger(options.rows ?? DEFAULT_GRID_ROWS, 2, "rows");
    const timeStepCount = validateInteger(
      options.timeStepCount ?? DEFAULT_TIME_STEP_COUNT,
      1,
      "timeStepCount",
    );
    const timeStepHours = validateInteger(
      options.timeStepHours ?? DEFAULT_TIME_STEP_HOURS,
      1,
      "timeStepHours",
    );
    const startTime = options.startTime ?? DEFAULT_START_TIME;
    const startMilliseconds = parseIsoTime(startTime, "startTime");
    this.#startUtcHour =
      new Date(startMilliseconds).getUTCHours() +
      new Date(startMilliseconds).getUTCMinutes() / 60;
    this.timeSteps = createTimeSteps(
      startTime,
      timeStepCount,
      timeStepHours,
    );
    const finalTimeStep = this.timeSteps[this.timeSteps.length - 1];
    if (!finalTimeStep) {
      throw new Error("Synthetic provider requires at least one time step.");
    }

    this.metadata = Object.freeze({
      datasetId: this.id,
      title: "Tsag-uur deterministic synthetic weather field",
      dataKind: "synthetic",
      isSynthetic: true,
      isScientificallyValidated: false,
      source: "Tsag-uur хөгжүүлэлтийн аналитик үүсгэгч",
      model: "SyntheticWeatherProvider v1 (цаг уурын загвар биш)",
      runTime: DEFAULT_RUN_TIME,
      generatedAt: DEFAULT_GENERATED_AT,
      validFrom: this.timeSteps[0]?.validTime ?? startTime,
      validUntil: finalTimeStep.validTime,
      timeStepHours,
      timeStepCount,
      bounds,
      gridColumns: columns,
      gridRows: rows,
      nominalResolutionKm: nominalResolutionKm(bounds, columns, rows),
      processingVersion: "synthetic-analytic-v1.0.0",
      units: SYNTHETIC_WEATHER_UNITS,
      disclaimer:
        "DEMO — Зохиомол өгөгдөл, бодит цаг агаарын мэдээ биш. Шинжлэх ухаанаар баталгаажаагүй тул бодит шийдвэрт ашиглахгүй.",
    });
  }

  contains(latitude: number, longitude: number): boolean {
    return containsCoordinates(this.metadata.bounds, latitude, longitude);
  }

  getGrid(time: WeatherTimeSelector): WeatherGrid {
    const timeStep = this.#resolveTimeStep(time);
    const cached = this.#gridCache.get(timeStep.index);
    if (cached) {
      return cached;
    }

    const grid = this.#generateGrid(timeStep);
    this.#gridCache.set(timeStep.index, grid);
    return grid;
  }

  sample(
    latitude: number,
    longitude: number,
    time: WeatherTimeSelector,
  ): WeatherSample | null {
    return sampleWeatherGrid(this.getGrid(time), latitude, longitude);
  }

  getPointForecast(
    latitude: number,
    longitude: number,
  ): WeatherPointForecast | null {
    if (!this.contains(latitude, longitude)) {
      return null;
    }

    const steps: WeatherSample[] = [];
    for (const timeStep of this.timeSteps) {
      const sample = this.sample(latitude, longitude, timeStep);
      if (sample) {
        steps.push(sample);
      }
    }

    return Object.freeze({
      location: Object.freeze({ latitude, longitude }),
      metadata: this.metadata,
      steps: Object.freeze(steps),
    });
  }

  #resolveTimeStep(time: WeatherTimeSelector): WeatherTimeStep {
    if (typeof time === "number") {
      if (!Number.isInteger(time)) {
        throw new RangeError("Weather time index must be an integer.");
      }
      const timeStep = this.timeSteps[time];
      if (!timeStep) {
        throw new RangeError(`Weather time index ${time} is outside this dataset.`);
      }
      return timeStep;
    }

    const key = typeof time === "string" ? time : time.id;
    const timeStep = this.timeSteps.find(
      (candidate) => candidate.id === key || candidate.validTime === key,
    );
    if (!timeStep) {
      throw new RangeError(`Unknown weather time selector: ${key}`);
    }
    return timeStep;
  }

  #generateGrid(timeStep: WeatherTimeStep): WeatherGrid {
    const { bounds, gridColumns: columns, gridRows: rows } = this.metadata;
    const longitudeStep = (bounds.east - bounds.west) / (columns - 1);
    const latitudeStep = (bounds.north - bounds.south) / (rows - 1);
    const fieldLength = columns * rows;
    const fields: WeatherGridFields = {
      temperatureC: new Float32Array(fieldLength),
      windUMps: new Float32Array(fieldLength),
      windVMps: new Float32Array(fieldLength),
      windSpeedMps: new Float32Array(fieldLength),
      windDirectionDegrees: new Float32Array(fieldLength),
      relativeHumidityPercent: new Float32Array(fieldLength),
      pressureHpa: new Float32Array(fieldLength),
      hourlyPrecipitationMm: new Float32Array(fieldLength),
      conditionCodes: new Uint8Array(fieldLength),
    };

    for (let row = 0; row < rows; row += 1) {
      const latitude = bounds.south + row * latitudeStep;
      for (let column = 0; column < columns; column += 1) {
        const longitude = bounds.west + column * longitudeStep;
        const index = row * columns + column;
        const values = calculateSyntheticFields(
          latitude,
          longitude,
          timeStep.offsetHours,
          this.#startUtcHour,
        );
        const windSpeedMps = Math.hypot(values.windUMps, values.windVMps);
        const windDirectionDegrees = windDirectionFromComponents(
          values.windUMps,
          values.windVMps,
        );
        const condition = resolveWeatherCondition({
          latitude,
          longitude,
          temperatureC: values.temperatureC,
          windSpeedMps,
          relativeHumidityPercent: values.relativeHumidityPercent,
          hourlyPrecipitationMm: values.hourlyPrecipitationMm,
        });

        fields.temperatureC[index] = values.temperatureC;
        fields.windUMps[index] = values.windUMps;
        fields.windVMps[index] = values.windVMps;
        fields.windSpeedMps[index] = windSpeedMps;
        fields.windDirectionDegrees[index] = windDirectionDegrees;
        fields.relativeHumidityPercent[index] =
          values.relativeHumidityPercent;
        fields.pressureHpa[index] = values.pressureHpa;
        fields.hourlyPrecipitationMm[index] =
          values.hourlyPrecipitationMm;
        fields.conditionCodes[index] = conditionToCode(condition);
      }
    }

    return Object.freeze({
      metadata: this.metadata,
      timeStep,
      bounds,
      columns,
      rows,
      longitudeStep,
      latitudeStep,
      fields,
    });
  }
}

export const syntheticWeatherProvider: WeatherDataProvider =
  new SyntheticWeatherProvider();

