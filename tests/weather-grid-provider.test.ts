import assert from "node:assert/strict";
import test from "node:test";

import { WEATHER_LAYER_DEFINITIONS } from "../src/features/weather-data/constants.ts";
import { OpenMeteoWeatherProvider } from "../src/features/weather-data/open-meteo-weather-provider.ts";
import type {
  SerializedWeatherGridFields,
  WeatherGridPayload,
} from "../src/features/weather-data/types.ts";

function fields(snowfall: readonly number[]): SerializedWeatherGridFields {
  return {
    temperatureC: [-4, -2, 0, 2],
    windUMps: [4, 4, 4, 4],
    windVMps: [0, 0, 0, 0],
    windSpeedMps: [4, 4, 4, 4],
    windDirectionDegrees: [270, 270, 270, 270],
    relativeHumidityPercent: [70, 70, 80, 80],
    pressureHpa: [1010, 1011, 1012, 1013],
    hourlyPrecipitationMm: [0, 0.2, 0.4, 0.6],
    snowfallCm: snowfall,
    conditionCodes: [1, 2, 3, 3],
  };
}

function payload(): WeatherGridPayload {
  const timeSteps = [
    { id: "gfs-0", index: 0, validTime: "2026-11-12T12:00:00.000Z", offsetHours: 0, intervalHours: 1, labelMn: "11-р сарын 12 · 20:00" },
    { id: "gfs-1", index: 1, validTime: "2026-11-12T13:00:00.000Z", offsetHours: 1, intervalHours: 1, labelMn: "11-р сарын 12 · 21:00" },
  ] as const;
  return {
    metadata: {
      datasetId: "test-gfs",
      title: "Test GFS grid",
      dataKind: "forecast",
      isSynthetic: false,
      isScientificallyValidated: false,
      source: "Open-Meteo GFS API",
      sourceUrl: "https://open-meteo.com/",
      licence: "CC BY 4.0",
      model: "NOAA GFS Global",
      runTime: "",
      generatedAt: "2026-11-12T11:55:00.000Z",
      validFrom: timeSteps[0].validTime,
      validUntil: timeSteps[1].validTime,
      timeStepHours: 1,
      timeStepCount: 2,
      bounds: { west: 100, south: 45, east: 102, north: 47 },
      gridColumns: 2,
      gridRows: 2,
      nominalResolutionKm: 150,
      processingVersion: "test-v1",
      units: {
        temperature: "°C",
        wind: "m/s",
        windDirection: "degrees from true north",
        humidity: "%",
        pressure: "hPa",
        precipitation: "mm/h",
        snowfall: "cm/h",
      },
      disclaimer: "Test only",
    },
    timeSteps,
    grids: [
      { timeStep: timeSteps[0], fields: fields([0, 0, 0.8, 1]) },
      { timeStep: timeSteps[1], fields: fields([0, 0, 1, 1.2]) },
    ],
  };
}

test("Open-Meteo payload hydrates a synchronous interpolated weather provider", () => {
  const provider = new OpenMeteoWeatherProvider(payload());
  const sample = provider.sample(46, 101, "gfs-0");
  assert.ok(sample);
  assert.equal(sample.windDirectionCardinal, "W");
  assert.ok(Math.abs(sample.snowfallCm - 0.45) < 1e-5);
  assert.equal(sample.condition, "snow");
  assert.equal(provider.getPointForecast(46, 101)?.steps.length, 2);
});

test("snowfall is an explicit selectable map layer", () => {
  const snowfall = WEATHER_LAYER_DEFINITIONS.find((layer) => layer.id === "snowfall");
  assert.ok(snowfall);
  assert.equal(snowfall.field, "snowfallCm");
  assert.equal(snowfall.unit, "см/ц");
});

test("Open-Meteo provider rejects malformed grid lengths", () => {
  const malformed = payload();
  const first = malformed.grids[0]!;
  const broken: WeatherGridPayload = {
    ...malformed,
    grids: [{ ...first, fields: { ...first.fields, snowfallCm: [0] } }, malformed.grids[1]!],
  };
  assert.throws(() => new OpenMeteoWeatherProvider(broken), /snowfallCm/);
});
