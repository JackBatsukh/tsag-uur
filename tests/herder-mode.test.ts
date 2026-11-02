import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseDirection,
  directionalCoordinates,
  isSevereWeatherCode,
  largestSixHourTemperatureDrop,
  summarizeDirection,
  weatherCodeLabelMn,
} from "../src/features/herder-mode/forecast-utils.ts";
import type { HerderHourlyWeather, PastureDirectionSummary } from "../src/features/herder-mode/types.ts";
import {
  cardinalFromDegrees,
  windComponentsFromDirection,
  windDirectionFromComponents,
} from "../src/features/weather-data/interpolation.ts";

function hour(index: number, overrides: Partial<HerderHourlyWeather> = {}): HerderHourlyWeather {
  return {
    time: new Date(Date.UTC(2026, 10, 2, index)).toISOString(),
    temperatureC: 5 - index,
    apparentTemperatureC: 3 - index,
    precipitationProbabilityPercent: index * 5,
    precipitationMm: index === 3 ? 2 : 0,
    snowfallCm: 0,
    weatherCode: 1,
    windSpeedMps: 3,
    windDirectionDegrees: 270,
    windGustMps: 5 + index,
    visibilityM: 20_000,
    ...overrides,
  };
}

test("meteorological direction converts to and from U/V components", () => {
  const westWind = windComponentsFromDirection(270, 10);
  assert.ok(Math.abs(westWind.u - 10) < 1e-10);
  assert.ok(Math.abs(westWind.v) < 1e-10);
  assert.ok(Math.abs(windDirectionFromComponents(westWind.u, westWind.v) - 270) < 1e-10);
  assert.equal(cardinalFromDegrees(270), "W");
});

test("direction points are placed north, east, south, and west", () => {
  const origin = { latitude: 47.9, longitude: 106.9 };
  const [north, east, south, west] = directionalCoordinates(origin, 12);
  assert.ok(north!.latitude > origin.latitude);
  assert.ok(east!.longitude > origin.longitude);
  assert.ok(south!.latitude < origin.latitude);
  assert.ok(west!.longitude < origin.longitude);
});

test("direction summary exposes raw comparable weather without a fabricated probability score", () => {
  const summary = summarizeDirection(
    "north",
    { latitude: 48, longitude: 106.9 },
    [hour(0), hour(1), hour(2, { weatherCode: 75, precipitationMm: 4 })],
  );
  assert.equal(summary.labelMn, "Хойд");
  assert.equal(summary.precipitationTotalMm, 4);
  assert.equal(summary.weatherCode, 75);
  assert.equal(JSON.stringify(summary).includes("score"), false);
});

test("pasture direction selection follows the herder-selected single priority", () => {
  const base: Omit<PastureDirectionSummary, "id" | "labelMn" | "maxWindGustMps" | "precipitationTotalMm" | "minApparentTemperatureC"> = {
    bearingDegrees: 0,
    coordinates: { latitude: 47, longitude: 106 },
    distanceKm: 12,
    precipitationProbabilityMaxPercent: 20,
    maxTemperatureC: 4,
    minVisibilityM: 10_000,
    weatherCode: 1,
  };
  const directions: PastureDirectionSummary[] = [
    { ...base, id: "north", labelMn: "Хойд", maxWindGustMps: 3, precipitationTotalMm: 6, minApparentTemperatureC: -12 },
    { ...base, id: "south", labelMn: "Өмнөд", maxWindGustMps: 8, precipitationTotalMm: 0, minApparentTemperatureC: -2 },
  ];
  assert.equal(chooseDirection(directions, "wind")?.id, "north");
  assert.equal(chooseDirection(directions, "precipitation")?.id, "south");
  assert.equal(chooseDirection(directions, "cold")?.id, "south");
});

test("WMO severe codes and six-hour temperature change are surfaced", () => {
  assert.equal(isSevereWeatherCode(75), true);
  assert.equal(isSevereWeatherCode(3), false);
  assert.equal(weatherCodeLabelMn(95), "Аянгатай");
  const drop = largestSixHourTemperatureDrop(Array.from({ length: 8 }, (_, index) => hour(index)));
  assert.equal(drop?.amountC, 6);
});
