import { cardinalFromDegrees } from "../weather-data/interpolation.ts";

import type {
  AgriculturalForecastDay,
  FarmerDemoScenario,
  FarmerScenarioKind,
} from "./types.ts";

export const FARMER_DEMO_GENERATED_AT = "2026-05-01T00:00:00+08:00";

interface DayInput {
  readonly minimumTemperatureC: number;
  readonly maximumTemperatureC: number;
  readonly precipitationMm: number;
  readonly maximumWindSpeedMps: number;
  readonly windDirectionDegrees: number;
  readonly minimumRelativeHumidityPercent: number;
  readonly maximumRelativeHumidityPercent: number;
}

interface ScenarioInput {
  readonly id: string;
  readonly kind: FarmerScenarioKind;
  readonly labelMn: string;
  readonly summaryMn: string;
  readonly startDate: string;
  readonly locationNameMn: string;
  readonly location: Readonly<{ latitude: number; longitude: number }>;
  readonly days: readonly DayInput[];
}

function addUtcDays(date: string, amount: number): string {
  const milliseconds = Date.parse(`${date}T00:00:00Z`);
  return new Date(milliseconds + amount * 86_400_000).toISOString().slice(0, 10);
}

function conditionForDay(day: DayInput): AgriculturalForecastDay["condition"] {
  if (day.precipitationMm >= 0.4) {
    return day.minimumTemperatureC <= 0 ? "snow" : "rain";
  }
  if (day.maximumWindSpeedMps >= 12 && day.minimumRelativeHumidityPercent < 30) {
    return "dusty";
  }
  if (day.maximumRelativeHumidityPercent >= 72) return "cloudy";
  return "clear";
}

function createScenario(input: ScenarioInput): FarmerDemoScenario {
  const days = input.days.map((day, index): AgriculturalForecastDay => {
    const validDate = addUtcDays(input.startDate, index);
    return {
      id: `${input.id}-${validDate}`,
      validDate,
      minimumTemperatureC: day.minimumTemperatureC,
      maximumTemperatureC: day.maximumTemperatureC,
      precipitationMm: day.precipitationMm,
      precipitationProbabilityPercent: null,
      maximumWindSpeedMps: day.maximumWindSpeedMps,
      windDirectionDegrees: day.windDirectionDegrees,
      windDirectionCardinal: cardinalFromDegrees(day.windDirectionDegrees),
      minimumRelativeHumidityPercent: day.minimumRelativeHumidityPercent,
      maximumRelativeHumidityPercent: day.maximumRelativeHumidityPercent,
      condition: conditionForDay(day),
    };
  });
  const first = days[0]?.validDate ?? input.startDate;
  const last = days.at(-1)?.validDate ?? input.startDate;

  return Object.freeze({
    id: input.id,
    kind: input.kind,
    labelMn: input.labelMn,
    summaryMn: input.summaryMn,
    locationNameMn: input.locationNameMn,
    location: input.location,
    days: Object.freeze(days),
    provenance: Object.freeze({
      datasetId: `farmer-demo-${input.id}-v1`,
      dataKind: "synthetic",
      sourceMn: "Tsag-uur deterministic agricultural demo generator",
      modelMn: "Зохиомол 7 хоногийн жишиг; бодит WRF эсвэл станцын мэдээ биш",
      generatedAt: FARMER_DEMO_GENERATED_AT,
      validFrom: `${first}T00:00:00+08:00`,
      validUntil: `${last}T23:59:59+08:00`,
      nominalResolutionKm: 27,
      isSynthetic: true,
      isScientificallyValidated: false,
      limitationsMn: Object.freeze([
        "Хур тунадасны магадлал агуулаагүй deterministic demo.",
        "Хөрсний чийг, хөрсний температур, нарны цацраг, бодит ET₀ агуулаагүй.",
        "Албан анхааруулга, баталгаажсан ургацын болц, усалгааны хэмжээ биш.",
      ]),
    }),
  });
}

export const FARMER_DEMO_SCENARIOS: readonly FarmerDemoScenario[] = Object.freeze([
  createScenario({
    id: "dry-central",
    kind: "dry-week",
    labelMn: "Хуурай долоо хоног",
    summaryMn: "Бороо бага, өдөр халуун, салхи нэмэгдэх усалгааны ажиглалтын жишээ.",
    startDate: "2026-06-15",
    locationNameMn: "Төв аймаг · Демо талбай",
    location: { latitude: 47.58, longitude: 106.32 },
    days: [
      { minimumTemperatureC: 8, maximumTemperatureC: 24, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 285, minimumRelativeHumidityPercent: 31, maximumRelativeHumidityPercent: 62 },
      { minimumTemperatureC: 9, maximumTemperatureC: 26, precipitationMm: 0, maximumWindSpeedMps: 7, windDirectionDegrees: 275, minimumRelativeHumidityPercent: 27, maximumRelativeHumidityPercent: 58 },
      { minimumTemperatureC: 11, maximumTemperatureC: 29, precipitationMm: 0, maximumWindSpeedMps: 9, windDirectionDegrees: 260, minimumRelativeHumidityPercent: 23, maximumRelativeHumidityPercent: 52 },
      { minimumTemperatureC: 12, maximumTemperatureC: 30, precipitationMm: 0.2, maximumWindSpeedMps: 8, windDirectionDegrees: 245, minimumRelativeHumidityPercent: 22, maximumRelativeHumidityPercent: 50 },
      { minimumTemperatureC: 10, maximumTemperatureC: 27, precipitationMm: 0, maximumWindSpeedMps: 6, windDirectionDegrees: 300, minimumRelativeHumidityPercent: 29, maximumRelativeHumidityPercent: 59 },
      { minimumTemperatureC: 9, maximumTemperatureC: 25, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 315, minimumRelativeHumidityPercent: 34, maximumRelativeHumidityPercent: 64 },
      { minimumTemperatureC: 8, maximumTemperatureC: 23, precipitationMm: 0.5, maximumWindSpeedMps: 5, windDirectionDegrees: 330, minimumRelativeHumidityPercent: 38, maximumRelativeHumidityPercent: 69 },
    ],
  }),
  createScenario({
    id: "rainy-selenge",
    kind: "rainy-week",
    labelMn: "Бороотой долоо хоног",
    summaryMn: "Талбайн ажил, усалгааг хойшлуулах эсэхийг шалгах борооны жишээ.",
    startDate: "2026-07-06",
    locationNameMn: "Сэлэнгэ аймаг · Демо талбай",
    location: { latitude: 49.49, longitude: 106.92 },
    days: [
      { minimumTemperatureC: 12, maximumTemperatureC: 21, precipitationMm: 3.4, maximumWindSpeedMps: 5, windDirectionDegrees: 35, minimumRelativeHumidityPercent: 55, maximumRelativeHumidityPercent: 88 },
      { minimumTemperatureC: 11, maximumTemperatureC: 18, precipitationMm: 12.6, maximumWindSpeedMps: 7, windDirectionDegrees: 45, minimumRelativeHumidityPercent: 67, maximumRelativeHumidityPercent: 94 },
      { minimumTemperatureC: 10, maximumTemperatureC: 17, precipitationMm: 8.2, maximumWindSpeedMps: 6, windDirectionDegrees: 55, minimumRelativeHumidityPercent: 69, maximumRelativeHumidityPercent: 96 },
      { minimumTemperatureC: 11, maximumTemperatureC: 20, precipitationMm: 2.3, maximumWindSpeedMps: 5, windDirectionDegrees: 70, minimumRelativeHumidityPercent: 58, maximumRelativeHumidityPercent: 90 },
      { minimumTemperatureC: 12, maximumTemperatureC: 23, precipitationMm: 0.5, maximumWindSpeedMps: 4, windDirectionDegrees: 95, minimumRelativeHumidityPercent: 44, maximumRelativeHumidityPercent: 79 },
      { minimumTemperatureC: 13, maximumTemperatureC: 25, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 110, minimumRelativeHumidityPercent: 37, maximumRelativeHumidityPercent: 71 },
      { minimumTemperatureC: 12, maximumTemperatureC: 24, precipitationMm: 1.2, maximumWindSpeedMps: 5, windDirectionDegrees: 125, minimumRelativeHumidityPercent: 42, maximumRelativeHumidityPercent: 76 },
    ],
  }),
  createScenario({
    id: "frost-darhan",
    kind: "frost-period",
    labelMn: "Хярууны боломжит үе",
    summaryMn: "2 м-ийн агаарын минимум багадах боловч навчин гадаргын хярууг батлахгүй жишээ.",
    startDate: "2026-09-01",
    locationNameMn: "Дархан-Уул · Демо талбай",
    location: { latitude: 49.48, longitude: 105.95 },
    days: [
      { minimumTemperatureC: 3, maximumTemperatureC: 17, precipitationMm: 0, maximumWindSpeedMps: 4, windDirectionDegrees: 330, minimumRelativeHumidityPercent: 38, maximumRelativeHumidityPercent: 73 },
      { minimumTemperatureC: 1, maximumTemperatureC: 14, precipitationMm: 0, maximumWindSpeedMps: 3, windDirectionDegrees: 350, minimumRelativeHumidityPercent: 42, maximumRelativeHumidityPercent: 81 },
      { minimumTemperatureC: -2, maximumTemperatureC: 12, precipitationMm: 0, maximumWindSpeedMps: 2, windDirectionDegrees: 10, minimumRelativeHumidityPercent: 46, maximumRelativeHumidityPercent: 86 },
      { minimumTemperatureC: -1, maximumTemperatureC: 13, precipitationMm: 0.3, maximumWindSpeedMps: 3, windDirectionDegrees: 20, minimumRelativeHumidityPercent: 44, maximumRelativeHumidityPercent: 84 },
      { minimumTemperatureC: 2, maximumTemperatureC: 16, precipitationMm: 0, maximumWindSpeedMps: 4, windDirectionDegrees: 60, minimumRelativeHumidityPercent: 39, maximumRelativeHumidityPercent: 75 },
      { minimumTemperatureC: 4, maximumTemperatureC: 18, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 90, minimumRelativeHumidityPercent: 35, maximumRelativeHumidityPercent: 70 },
      { minimumTemperatureC: 5, maximumTemperatureC: 19, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 110, minimumRelativeHumidityPercent: 33, maximumRelativeHumidityPercent: 67 },
    ],
  }),
  createScenario({
    id: "windy-steppe",
    kind: "strong-wind",
    labelMn: "Хүчтэй салхитай үе",
    summaryMn: "Шүршилт, талбайн ажил болон хөрсний хуурайшилтад анхаарах салхины жишээ.",
    startDate: "2026-05-18",
    locationNameMn: "Хэнтий аймаг · Демо талбай",
    location: { latitude: 47.32, longitude: 110.65 },
    days: [
      { minimumTemperatureC: 4, maximumTemperatureC: 18, precipitationMm: 0, maximumWindSpeedMps: 9, windDirectionDegrees: 270, minimumRelativeHumidityPercent: 27, maximumRelativeHumidityPercent: 58 },
      { minimumTemperatureC: 5, maximumTemperatureC: 20, precipitationMm: 0, maximumWindSpeedMps: 13, windDirectionDegrees: 265, minimumRelativeHumidityPercent: 24, maximumRelativeHumidityPercent: 54 },
      { minimumTemperatureC: 7, maximumTemperatureC: 22, precipitationMm: 0, maximumWindSpeedMps: 16, windDirectionDegrees: 255, minimumRelativeHumidityPercent: 21, maximumRelativeHumidityPercent: 50 },
      { minimumTemperatureC: 6, maximumTemperatureC: 19, precipitationMm: 0.4, maximumWindSpeedMps: 14, windDirectionDegrees: 250, minimumRelativeHumidityPercent: 25, maximumRelativeHumidityPercent: 59 },
      { minimumTemperatureC: 5, maximumTemperatureC: 17, precipitationMm: 0, maximumWindSpeedMps: 11, windDirectionDegrees: 280, minimumRelativeHumidityPercent: 29, maximumRelativeHumidityPercent: 63 },
      { minimumTemperatureC: 4, maximumTemperatureC: 16, precipitationMm: 0, maximumWindSpeedMps: 7, windDirectionDegrees: 300, minimumRelativeHumidityPercent: 34, maximumRelativeHumidityPercent: 67 },
      { minimumTemperatureC: 6, maximumTemperatureC: 19, precipitationMm: 0.8, maximumWindSpeedMps: 6, windDirectionDegrees: 310, minimumRelativeHumidityPercent: 36, maximumRelativeHumidityPercent: 72 },
    ],
  }),
  createScenario({
    id: "harvest-bulgan",
    kind: "harvest-window",
    labelMn: "Хураалтын боломжит цонх",
    summaryMn: "Цаг агаарын хувьд харьцангуй хуурай өдрүүдийг харьцуулах жишээ.",
    startDate: "2026-08-24",
    locationNameMn: "Булган аймаг · Демо талбай",
    location: { latitude: 48.81, longitude: 103.53 },
    days: [
      { minimumTemperatureC: 7, maximumTemperatureC: 20, precipitationMm: 2.5, maximumWindSpeedMps: 7, windDirectionDegrees: 40, minimumRelativeHumidityPercent: 42, maximumRelativeHumidityPercent: 78 },
      { minimumTemperatureC: 8, maximumTemperatureC: 22, precipitationMm: 0.4, maximumWindSpeedMps: 5, windDirectionDegrees: 80, minimumRelativeHumidityPercent: 34, maximumRelativeHumidityPercent: 69 },
      { minimumTemperatureC: 9, maximumTemperatureC: 24, precipitationMm: 0, maximumWindSpeedMps: 4, windDirectionDegrees: 110, minimumRelativeHumidityPercent: 29, maximumRelativeHumidityPercent: 62 },
      { minimumTemperatureC: 10, maximumTemperatureC: 25, precipitationMm: 0, maximumWindSpeedMps: 5, windDirectionDegrees: 130, minimumRelativeHumidityPercent: 27, maximumRelativeHumidityPercent: 59 },
      { minimumTemperatureC: 9, maximumTemperatureC: 23, precipitationMm: 0.2, maximumWindSpeedMps: 6, windDirectionDegrees: 150, minimumRelativeHumidityPercent: 31, maximumRelativeHumidityPercent: 65 },
      { minimumTemperatureC: 8, maximumTemperatureC: 19, precipitationMm: 5.8, maximumWindSpeedMps: 8, windDirectionDegrees: 20, minimumRelativeHumidityPercent: 51, maximumRelativeHumidityPercent: 86 },
      { minimumTemperatureC: 6, maximumTemperatureC: 17, precipitationMm: 1.1, maximumWindSpeedMps: 6, windDirectionDegrees: 340, minimumRelativeHumidityPercent: 45, maximumRelativeHumidityPercent: 78 },
    ],
  }),
]);

export function getFarmerDemoScenario(id: string): FarmerDemoScenario {
  return FARMER_DEMO_SCENARIOS.find((scenario) => scenario.id === id) ?? FARMER_DEMO_SCENARIOS[0]!;
}
