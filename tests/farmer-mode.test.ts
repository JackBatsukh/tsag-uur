import assert from "node:assert/strict";
import test from "node:test";

import {
  assessAgriculturalRisks,
  buildHarvestAdvisory,
  buildIrrigationAdvisory,
  rankHarvestWeatherWindows,
  sumForecastPrecipitation,
} from "../src/features/farmer-mode/advisory-engine.ts";
import {
  CROP_CONFIG,
  DEFAULT_FARM_FIELD,
} from "../src/features/farmer-mode/config.ts";
import {
  FARMER_DEMO_SCENARIOS,
  getFarmerDemoScenario,
} from "../src/features/farmer-mode/demo-scenarios.ts";
import {
  createDefaultFarmerLocalState,
  parseFarmerLocalState,
  serializeFarmerLocalState,
} from "../src/features/farmer-mode/storage.ts";

test("farmer scenarios contain seven contiguous forecast dates", () => {
  for (const scenario of FARMER_DEMO_SCENARIOS) {
    assert.equal(scenario.days.length, 7);
    for (let index = 1; index < scenario.days.length; index += 1) {
      const previous = Date.parse(`${scenario.days[index - 1]!.validDate}T00:00:00Z`);
      const current = Date.parse(`${scenario.days[index]!.validDate}T00:00:00Z`);
      assert.equal(current - previous, 86_400_000);
    }
    assert.ok(scenario.days.every((day) => Date.parse(`${day.validDate}T00:00:00+08:00`) >= Date.parse(scenario.provenance.validFrom)));
    assert.equal(scenario.provenance.dataKind, "synthetic");
  }
});

test("daily interval rainfall is summed once without cumulative double counting", () => {
  const rainy = getFarmerDemoScenario("rainy-selenge");
  const expected = rainy.days.reduce((total, day) => total + day.precipitationMm, 0);
  assert.equal(sumForecastPrecipitation(rainy.days), expected);
  assert.equal(sumForecastPrecipitation([{ ...rainy.days[0]!, precipitationMm: -1 }]), 0);
});

test("crop configuration covers every required crop with distinct guidance", () => {
  assert.deepEqual(
    Object.keys(CROP_CONFIG).sort(),
    ["cabbage", "carrot", "greenhouse-vegetables", "onion", "potato", "wheat"],
  );
  assert.equal(new Set(Object.values(CROP_CONFIG).map((crop) => crop.irrigationNoteMn)).size, 6);
  assert.ok(Object.values(CROP_CONFIG).every((crop) => crop.supportedStages.includes("unknown")));
});

test("irrigation advisory never invents missing soil moisture", () => {
  const dry = getFarmerDemoScenario("dry-central");
  const advisory = buildIrrigationAdvisory(dry, DEFAULT_FARM_FIELD);
  assert.equal(advisory.level, "insufficient");
  assert.ok(advisory.missingInputsMn.includes("Хөрсний чийгийн бодит хэмжилт"));
  assert.ok(advisory.supportingMeasurementsMn.some((item) => item.includes("хэмжилт оруулаагүй")));
  assert.ok(advisory.uncertaintyMn.some((item) => item.includes("усны эзлэхүүний")));
});

test("rainy scenario suggests reassessment rather than an irrigation order", () => {
  const rainy = getFarmerDemoScenario("rainy-selenge");
  const advisory = buildIrrigationAdvisory(rainy, {
    ...DEFAULT_FARM_FIELD,
    measuredSoilMoisturePercent: 31,
  });
  assert.equal(advisory.level, "watch");
  assert.match(advisory.summaryMn, /дахин шалгана/);
  assert.equal(advisory.isIllustrative, true);
});

test("harvest weather windows rank deterministically and keep maturity separate", () => {
  const scenario = getFarmerDemoScenario("harvest-bulgan");
  const first = rankHarvestWeatherWindows(scenario, DEFAULT_FARM_FIELD);
  const second = rankHarvestWeatherWindows(scenario, DEFAULT_FARM_FIELD);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first[0]?.maturityConfirmed, false);
  assert.match(buildHarvestAdvisory(scenario, DEFAULT_FARM_FIELD).summaryMn, /боловсролт баталгаажаагүй/i);
  const ready = buildHarvestAdvisory(scenario, {
    ...DEFAULT_FARM_FIELD,
    maturityObservation: "ready",
  });
  assert.ok(!ready.summaryMn.includes("баталгаажаагүй"));
});

test("frost screen states the air-versus-plant temperature limitation", () => {
  const scenario = getFarmerDemoScenario("frost-darhan");
  const frost = assessAgriculturalRisks(scenario).find((risk) => risk.kind === "frost");
  assert.ok(frost);
  assert.equal(frost.level, "avoid");
  assert.match(frost.explanationMn, /2 м-ийн/);
  assert.match(frost.limitationMn, /Навч\/гадаргын температур/);
  assert.match(frost.sourceMn, /FAO/);
});

test("synthetic farmer scenarios and provenance are deterministic", () => {
  const first = JSON.stringify(FARMER_DEMO_SCENARIOS);
  const second = JSON.stringify(FARMER_DEMO_SCENARIOS.map((scenario) => getFarmerDemoScenario(scenario.id)));
  assert.equal(first, second);
  assert.deepEqual(
    new Set(FARMER_DEMO_SCENARIOS.map((scenario) => scenario.kind)),
    new Set(["dry-week", "rainy-week", "frost-period", "strong-wind", "harvest-window"]),
  );
  assert.ok(FARMER_DEMO_SCENARIOS.every((scenario) => scenario.provenance.isSynthetic && !scenario.provenance.isScientificallyValidated));
});

test("local storage validation round-trips valid state and recovers corrupt state", () => {
  const state = createDefaultFarmerLocalState();
  const valid = parseFarmerLocalState(serializeFarmerLocalState(state));
  assert.equal(valid.recovered, false);
  assert.deepEqual(valid.state, state);

  const malformed = parseFarmerLocalState("{not-json");
  assert.equal(malformed.recovered, true);
  assert.deepEqual(malformed.state, createDefaultFarmerLocalState());

  const invalid = JSON.parse(serializeFarmerLocalState(state));
  invalid.field.measuredSoilMoisturePercent = 250;
  const recovered = parseFarmerLocalState(JSON.stringify(invalid));
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.field.measuredSoilMoisturePercent, null);
});
