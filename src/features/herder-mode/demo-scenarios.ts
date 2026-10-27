import {
  windComponentsFromDirection,
  windDirectionFromComponents,
} from "../weather-data/interpolation.ts";

import type {
  DemoScenarioKind,
  HerderDemoScenario,
  HerderWeatherStep,
  VisibilityConcern,
} from "./types.ts";

export const DEMO_REFERENCE_TIME = "2026-10-27T04:00:00.000Z";
interface ScenarioRecipe {
  readonly id: string;
  readonly nameMn: string;
  readonly summaryMn: string;
  readonly kind: DemoScenarioKind;
  readonly defaultSpecies: HerderDemoScenario["defaultSpecies"];
  readonly defaultCount: number;
  readonly terrain: HerderDemoScenario["terrain"];
  readonly latitude: number;
  readonly longitude: number;
  readonly lastSeenOffsetHours: number;
  readonly eventPeakOffsetHours: number;
}

const RECIPES: readonly ScenarioRecipe[] = [
  {
    id: "snowstorm-khangai",
    nameMn: "Цасан шуурганы жишээ",
    summaryMn: "Хангайн бүсийн 6 цагийн алхамтай зохиомол цас, хүчтэй салхины хувилбар.",
    kind: "snowstorm",
    defaultSpecies: "sheep",
    defaultCount: 34,
    terrain: "mountain",
    latitude: 47.48,
    longitude: 101.45,
    lastSeenOffsetHours: -42,
    eventPeakOffsetHours: -30,
  },
  {
    id: "dust-gobi",
    nameMn: "Шороон шуурганы жишээ",
    summaryMn: "Говийн хуурай, хүчтэй салхитай DEMO хувилбар; аэрозолын бодит хэмжилт биш.",
    kind: "dust-storm",
    defaultSpecies: "camel",
    defaultCount: 12,
    terrain: "gobi",
    latitude: 44.31,
    longitude: 105.76,
    lastSeenOffsetHours: -30,
    eventPeakOffsetHours: -18,
  },
  {
    id: "rain-eastern-steppe",
    nameMn: "Их борооны жишээ",
    summaryMn: "Зүүн хээрийн 6 цагийн хур тунадас, салхины өөрчлөлтийн зохиомол хувилбар.",
    kind: "heavy-rain",
    defaultSpecies: "cattle",
    defaultCount: 18,
    terrain: "steppe",
    latitude: 47.18,
    longitude: 112.42,
    lastSeenOffsetHours: -24,
    eventPeakOffsetHours: -12,
  },
] as const;

function gaussian(hours: number, center: number, width: number): number {
  const normalized = (hours - center) / width;
  return Math.exp(-(normalized * normalized));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scenarioValues(
  recipe: ScenarioRecipe,
  offsetHours: number,
  index: number,
): Omit<HerderWeatherStep, "id" | "validTime" | "period"> {
  const event = gaussian(offsetHours, recipe.eventPeakOffsetHours, 22);
  const futurePulse = gaussian(offsetHours, 54, 30);
  const daily = Math.sin((index / 4) * Math.PI * 2);

  let temperatureC: number;
  let windSpeedMps: number;
  let windFromDegrees: number;
  let precipitationMm: number;
  let precipitationType: HerderWeatherStep["precipitationType"];
  let visibilityConcern: VisibilityConcern = "none";

  if (recipe.kind === "snowstorm") {
    temperatureC = -17 + 6 * daily - 12 * event - 4 * futurePulse;
    windSpeedMps = 4.5 + 13 * event + 4 * futurePulse;
    windFromDegrees = 300 + 22 * Math.sin(index * 0.31);
    precipitationMm = 8.5 * event + 2.5 * futurePulse;
    precipitationType = precipitationMm >= 0.2 ? "snow" : "none";
    if (event > 0.35 && windSpeedMps >= 8) visibilityConcern = "snow";
  } else if (recipe.kind === "dust-storm") {
    temperatureC = 10 + 8 * daily + 5 * event;
    windSpeedMps = 5 + 15 * event + 3 * futurePulse;
    windFromDegrees = 275 + 28 * Math.sin(index * 0.27);
    precipitationMm = Math.max(0, 0.5 * futurePulse - 0.2);
    precipitationType = precipitationMm >= 0.2 ? "rain" : "none";
    if (event > 0.28 && windSpeedMps >= 8) visibilityConcern = "dust";
  } else {
    temperatureC = 5 + 7 * daily - 3 * event;
    windSpeedMps = 3.5 + 7 * event + 2 * futurePulse;
    windFromDegrees = 95 + 34 * Math.sin(index * 0.23);
    precipitationMm = 15 * event + 5 * futurePulse;
    precipitationType = precipitationMm >= 0.2 ? "rain" : "none";
    if (event > 0.42) visibilityConcern = "rain";
  }

  const components = windComponentsFromDirection(windFromDegrees, windSpeedMps);
  return {
    temperatureC: round(temperatureC),
    windUMps: round(components.u, 2),
    windVMps: round(components.v, 2),
    windSpeedMps: round(Math.hypot(components.u, components.v)),
    windDirectionDegrees: round(
      windDirectionFromComponents(components.u, components.v),
      0,
    ),
    precipitationMm: round(precipitationMm),
    precipitationType,
    visibilityConcern,
  };
}

function createScenario(recipe: ScenarioRecipe): HerderDemoScenario {
  const referenceMs = Date.parse(DEMO_REFERENCE_TIME);
  const weather: HerderWeatherStep[] = [];
  let index = 0;
  for (let offsetHours = -168; offsetHours <= 168; offsetHours += 6) {
    const validTime = new Date(referenceMs + offsetHours * 60 * 60 * 1000).toISOString();
    weather.push(
      Object.freeze({
        id: `${recipe.id}-${offsetHours < 0 ? "h" : "f"}-${Math.abs(offsetHours)}`,
        validTime,
        period: offsetHours < 0 ? "historical" : "forecast",
        ...scenarioValues(recipe, offsetHours, index),
      }),
    );
    index += 1;
  }

  return Object.freeze({
    id: recipe.id,
    nameMn: recipe.nameMn,
    summaryMn: recipe.summaryMn,
    kind: recipe.kind,
    defaultSpecies: recipe.defaultSpecies,
    defaultCount: recipe.defaultCount,
    terrain: recipe.terrain,
    location: Object.freeze({
      latitude: recipe.latitude,
      longitude: recipe.longitude,
    }),
    lastSeenTime: new Date(
      referenceMs + recipe.lastSeenOffsetHours * 60 * 60 * 1000,
    ).toISOString(),
    weather: Object.freeze(weather),
  });
}

export const HERDER_DEMO_SCENARIOS: readonly HerderDemoScenario[] =
  Object.freeze(RECIPES.map(createScenario));

export function getDemoScenario(id: string): HerderDemoScenario {
  return HERDER_DEMO_SCENARIOS.find((scenario) => scenario.id === id) ??
    HERDER_DEMO_SCENARIOS[0]!;
}

export function splitWeatherPeriods(weather: readonly HerderWeatherStep[]): Readonly<{
  historical: readonly HerderWeatherStep[];
  forecast: readonly HerderWeatherStep[];
}> {
  return Object.freeze({
    historical: Object.freeze(weather.filter((step) => step.period === "historical")),
    forecast: Object.freeze(weather.filter((step) => step.period === "forecast")),
  });
}

export const HERDER_DEMO_METADATA = Object.freeze({
  sourceMn: "Tsag-uur deterministic scenario generator",
  modelMn: "DEMO-HERDER-v1 — цаг уурын бодит загвар биш",
  generatedAt: DEMO_REFERENCE_TIME,
  intervalHours: 6,
  nominalResolutionMn: "Цэгэн зохиомол хувилбар; орон зайн бодит нарийвчлалгүй",
  statusMn: "DEMO — зохиомол түүх ба төлөв",
  limitationsMn:
    "Ажиглалт, WRF, радар, хиймэл дагуул, албан сэрэмжлүүлэг эсвэл малын GPS мэдээлэл ашиглаагүй.",
});
