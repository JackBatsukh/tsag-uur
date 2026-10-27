import assert from "node:assert/strict";
import test from "node:test";

import {
  cardinalFromDegrees,
  windComponentsFromDirection,
  windDirectionFromComponents,
} from "../src/features/weather-data/interpolation.ts";
import { SPECIES_CONFIG } from "../src/features/herder-mode/config.ts";
import {
  DEMO_REFERENCE_TIME,
  HERDER_DEMO_SCENARIOS,
  getDemoScenario,
  splitWeatherPeriods,
} from "../src/features/herder-mode/demo-scenarios.ts";
import { assessWeatherRisks } from "../src/features/herder-mode/risk-assessment.ts";
import {
  analyzeHistoricalWeather,
  buildSearchAreas,
} from "../src/features/herder-mode/search-heuristics.ts";
import type { MissingLivestockReport } from "../src/features/herder-mode/types.ts";

test("meteorological direction converts to and from U/V components", () => {
  const westWind = windComponentsFromDirection(270, 10);
  assert.ok(Math.abs(westWind.u - 10) < 1e-10);
  assert.ok(Math.abs(westWind.v) < 1e-10);
  assert.ok(Math.abs(windDirectionFromComponents(westWind.u, westWind.v) - 270) < 1e-10);
  assert.equal(cardinalFromDegrees(270), "W");
});

test("historical and forecast steps are strictly separated around reference time", () => {
  for (const scenario of HERDER_DEMO_SCENARIOS) {
    const periods = splitWeatherPeriods(scenario.weather);
    assert.ok(periods.historical.length > 0);
    assert.ok(periods.forecast.length > 0);
    assert.ok(periods.historical.every((step) => step.period === "historical"));
    assert.ok(periods.forecast.every((step) => step.period === "forecast"));
    assert.ok(periods.historical.every((step) => Date.parse(step.validTime) < Date.parse(DEMO_REFERENCE_TIME)));
    assert.ok(periods.forecast.every((step) => Date.parse(step.validTime) >= Date.parse(DEMO_REFERENCE_TIME)));
  }
});

test("demo scenarios are deterministic and include all required event examples", () => {
  const first = JSON.stringify(HERDER_DEMO_SCENARIOS);
  const second = JSON.stringify(HERDER_DEMO_SCENARIOS.map((scenario) => getDemoScenario(scenario.id)));
  assert.equal(first, second);
  assert.deepEqual(
    new Set(HERDER_DEMO_SCENARIOS.map((scenario) => scenario.kind)),
    new Set(["snowstorm", "dust-storm", "heavy-rain"]),
  );
});

test("species configuration covers six supported livestock types", () => {
  assert.deepEqual(
    Object.keys(SPECIES_CONFIG).sort(),
    ["camel", "cattle", "goat", "horse", "sheep", "yak"],
  );
  assert.ok(Object.values(SPECIES_CONFIG).every((item) => item.baseInspectionKm > 0));
});

test("search areas are deterministic, explainable, and contain no probability output", () => {
  const scenario = HERDER_DEMO_SCENARIOS[0]!;
  const report: MissingLivestockReport = {
    species: scenario.defaultSpecies,
    count: scenario.defaultCount,
    lastKnownLocation: scenario.location,
    lastSeenTime: scenario.lastSeenTime,
    observedDirectionDegrees: 80,
    possibleDirectionDegrees: 120,
    terrain: scenario.terrain,
    shelterContext: "Малчны тэмдэглэл",
    notes: "",
  };
  const analysis = analyzeHistoricalWeather(scenario.weather, report.lastSeenTime);
  const first = buildSearchAreas(report, analysis, { distanceMultiplier: 1, bearingShiftDegrees: 0 });
  const second = buildSearchAreas(report, analysis, { distanceMultiplier: 1, bearingShiftDegrees: 0 });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.length, 3);
  const text = JSON.stringify(first).toLowerCase();
  assert.equal(text.includes("%"), false);
  assert.equal(text.includes("магадлалтай"), false);
  assert.ok(first.every((area) => area.reasonsMn.length > 0 && area.limitationsMn.length > 0));
});

test("missing locations and invalid dates fail safely", () => {
  const scenario = HERDER_DEMO_SCENARIOS[0]!;
  const analysis = analyzeHistoricalWeather(scenario.weather, "not-a-date");
  assert.equal(analysis.stepsConsidered, 0);
  assert.ok(analysis.missingInputsMn.length > 0);
  const report: MissingLivestockReport = {
    species: "sheep",
    count: 1,
    lastKnownLocation: null,
    lastSeenTime: "not-a-date",
    observedDirectionDegrees: null,
    possibleDirectionDegrees: null,
    terrain: "steppe",
    shelterContext: "",
    notes: "",
  };
  assert.deepEqual(buildSearchAreas(report, analysis, { distanceMultiplier: 1, bearingShiftDegrees: 0 }), []);
  assert.equal(assessWeatherRisks(null)[0]?.level, "unavailable");
});
