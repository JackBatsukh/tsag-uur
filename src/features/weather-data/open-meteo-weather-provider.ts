import { containsCoordinates, sampleWeatherGrid } from "./interpolation.ts";
import type {
  SerializedWeatherGrid,
  WeatherDataProvider,
  WeatherGrid,
  WeatherGridFields,
  WeatherGridPayload,
  WeatherMetadata,
  WeatherPointForecast,
  WeatherSample,
  WeatherTimeSelector,
  WeatherTimeStep,
} from "./types.ts";

function finiteFloatArray(
  values: readonly number[],
  expectedLength: number,
  field: string,
): Float32Array {
  if (values.length !== expectedLength || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${field} must contain ${expectedLength} finite values.`);
  }
  return Float32Array.from(values);
}

function conditionArray(values: readonly number[], expectedLength: number): Uint8Array {
  if (values.length !== expectedLength || values.some((value) => !Number.isInteger(value) || value < 0 || value > 4)) {
    throw new TypeError(`conditionCodes must contain ${expectedLength} valid values.`);
  }
  return Uint8Array.from(values);
}

function hydrateFields(serialized: SerializedWeatherGrid, length: number): WeatherGridFields {
  const { fields } = serialized;
  return Object.freeze({
    temperatureC: finiteFloatArray(fields.temperatureC, length, "temperatureC"),
    windUMps: finiteFloatArray(fields.windUMps, length, "windUMps"),
    windVMps: finiteFloatArray(fields.windVMps, length, "windVMps"),
    windSpeedMps: finiteFloatArray(fields.windSpeedMps, length, "windSpeedMps"),
    windDirectionDegrees: finiteFloatArray(fields.windDirectionDegrees, length, "windDirectionDegrees"),
    relativeHumidityPercent: finiteFloatArray(fields.relativeHumidityPercent, length, "relativeHumidityPercent"),
    pressureHpa: finiteFloatArray(fields.pressureHpa, length, "pressureHpa"),
    hourlyPrecipitationMm: finiteFloatArray(fields.hourlyPrecipitationMm, length, "hourlyPrecipitationMm"),
    snowfallCm: finiteFloatArray(fields.snowfallCm, length, "snowfallCm"),
    conditionCodes: conditionArray(fields.conditionCodes, length),
  });
}

function validateFieldLengths(serialized: SerializedWeatherGrid, length: number): void {
  for (const [field, values] of Object.entries(serialized.fields)) {
    if (values.length !== length) {
      throw new TypeError(`${field} must contain ${length} values.`);
    }
  }
}

export class OpenMeteoWeatherProvider implements WeatherDataProvider {
  readonly id: string;
  readonly metadata: WeatherMetadata;
  readonly timeSteps: readonly WeatherTimeStep[];
  readonly #grids = new Map<string, WeatherGrid>();
  readonly #serializedGrids = new Map<string, SerializedWeatherGrid>();
  readonly #expectedLength: number;
  readonly #longitudeStep: number;
  readonly #latitudeStep: number;

  constructor(payload: WeatherGridPayload) {
    const { metadata } = payload;
    if (
      metadata.dataKind !== "forecast"
      || metadata.isSynthetic
      || metadata.gridColumns < 2
      || metadata.gridRows < 2
      || payload.timeSteps.length === 0
      || payload.grids.length !== payload.timeSteps.length
    ) {
      throw new TypeError("Open-Meteo grid payload metadata is invalid.");
    }

    this.id = metadata.datasetId;
    this.metadata = Object.freeze({ ...metadata, bounds: Object.freeze({ ...metadata.bounds }) });
    this.timeSteps = Object.freeze(payload.timeSteps.map((step) => Object.freeze({ ...step })));
    this.#expectedLength = metadata.gridColumns * metadata.gridRows;
    this.#longitudeStep = (metadata.bounds.east - metadata.bounds.west) / (metadata.gridColumns - 1);
    this.#latitudeStep = (metadata.bounds.north - metadata.bounds.south) / (metadata.gridRows - 1);

    payload.grids.forEach((serialized, index) => {
      const timeStep = this.timeSteps[index];
      if (!timeStep || serialized.timeStep.id !== timeStep.id) {
        throw new TypeError("Open-Meteo grid time steps are not aligned.");
      }
      validateFieldLengths(serialized, this.#expectedLength);
      this.#serializedGrids.set(timeStep.id, serialized);
    });
  }

  contains(latitude: number, longitude: number): boolean {
    return containsCoordinates(this.metadata.bounds, latitude, longitude);
  }

  getGrid(time: WeatherTimeSelector): WeatherGrid {
    const timeStep = this.#resolveTimeStep(time);
    const cached = this.#grids.get(timeStep.id);
    if (cached) return cached;
    const serialized = this.#serializedGrids.get(timeStep.id);
    if (!serialized) throw new RangeError(`Forecast grid ${timeStep.id} is unavailable.`);
    const grid = Object.freeze({
      metadata: this.metadata,
      timeStep,
      bounds: this.metadata.bounds,
      columns: this.metadata.gridColumns,
      rows: this.metadata.gridRows,
      longitudeStep: this.#longitudeStep,
      latitudeStep: this.#latitudeStep,
      fields: hydrateFields(serialized, this.#expectedLength),
    });
    this.#grids.set(timeStep.id, grid);
    return grid;
  }

  sample(latitude: number, longitude: number, time: WeatherTimeSelector): WeatherSample | null {
    return sampleWeatherGrid(this.getGrid(time), latitude, longitude);
  }

  getPointForecast(latitude: number, longitude: number): WeatherPointForecast | null {
    if (!this.contains(latitude, longitude)) return null;
    const steps = this.timeSteps.flatMap((timeStep) => {
      const sample = this.sample(latitude, longitude, timeStep);
      return sample ? [sample] : [];
    });
    return Object.freeze({
      location: Object.freeze({ latitude, longitude }),
      metadata: this.metadata,
      steps: Object.freeze(steps),
    });
  }

  #resolveTimeStep(time: WeatherTimeSelector): WeatherTimeStep {
    if (typeof time === "number") {
      if (!Number.isInteger(time) || !this.timeSteps[time]) {
        throw new RangeError(`Weather time index ${time} is outside this dataset.`);
      }
      return this.timeSteps[time];
    }
    const key = typeof time === "string" ? time : time.id;
    const timeStep = this.timeSteps.find((candidate) => candidate.id === key || candidate.validTime === key);
    if (!timeStep) throw new RangeError(`Unknown weather time selector: ${key}`);
    return timeStep;
  }
}
