import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeLivestockWeather,
  buildLivestockSearchAreas,
  chooseDirection,
  directionalCoordinates,
  forecastWindowFromTime,
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

test("road forecast windows start at the user-selected departure hour", () => {
  const hours = Array.from({ length: 18 }, (_, index) => hour(index));
  const selected = forecastWindowFromTime(hours, "2026-11-02T06:00:00.000Z", 12);
  assert.equal(selected.length, 12);
  assert.equal(selected[0]?.time, "2026-11-02T06:00:00.000Z");
  assert.deepEqual(forecastWindowFromTime(hours, "2026-11-03T12:00:00.000Z"), []);
});

test("historical wind is converted from coming-from direction to a downwind search influence", () => {
  const analysis = analyzeLivestockWeather([
    hour(0, { windDirectionDegrees: 270, windGustMps: 12, snowfallCm: 1 }),
    hour(1, { windDirectionDegrees: 270, windGustMps: 10, snowfallCm: 1 }),
    hour(2, { windDirectionDegrees: 280, windGustMps: 8 }),
  ]);
  assert.ok(analysis);
  assert.ok(analysis.weatherInfluenceBearingDegrees !== null);
  assert.ok(analysis.weatherInfluenceBearingDegrees! > 80 && analysis.weatherInfluenceBearingDegrees! < 110);
  assert.equal(analysis.totalSnowfallCm, 2);
});

test("livestock search areas use herder-entered distance and disclose weather versus reported direction", () => {
  const analysis = analyzeLivestockWeather([
    hour(0, { windDirectionDegrees: 0, windGustMps: 9 }),
    hour(1, { windDirectionDegrees: 0, windGustMps: 11 }),
  ]);
  assert.ok(analysis);
  const areas = buildLivestockSearchAreas(
    { latitude: 47.9, longitude: 106.9 },
    analysis,
    18,
    90,
  );
  assert.equal(areas[0]?.id, "reported");
  assert.equal(areas[0]?.distanceKm, 18);
  assert.ok(areas.some((area) => area.id === "weather"));
  assert.ok(areas.every((area) => area.polygon.length > 4));
  assert.equal(JSON.stringify(areas).includes("probability"), false);
});
