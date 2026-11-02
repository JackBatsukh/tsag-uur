import { CROP_CONFIG } from "./config.ts";
import type {
  AdvisoryResult,
  AgriculturalForecastDay,
  AgriculturalRisk,
  FarmField,
  FarmerDemoScenario,
  WeatherWindow,
} from "./types.ts";

/**
 * Conservative demonstration screens, not official warning or agronomic
 * thresholds. They rank synthetic weather for UI comparison only and require
 * Mongolia-specific field validation before operational use.
 */
export const DEMO_SCREENING_RULES = Object.freeze({
  frostConcernAirTemperatureC: 2,
  strongWindMps: 10,
  heavyDailyRainMm: 10,
  dryHotMaximumC: 28,
  dryHotMinimumHumidityPercent: 35,
  wetFieldworkRainMm: 5,
  favorableFieldworkRainMm: 1,
  favorableFieldworkWindMps: 8,
});

function validity(days: readonly AgriculturalForecastDay[]) {
  return {
    from: days[0]?.validDate ?? "unknown",
    until: days.at(-1)?.validDate ?? "unknown",
  } as const;
}

export function sumForecastPrecipitation(
  days: readonly AgriculturalForecastDay[],
): number {
  return days.reduce(
    (total, day) => total + (Number.isFinite(day.precipitationMm) && day.precipitationMm > 0 ? day.precipitationMm : 0),
    0,
  );
}

function commonMissingInputs(field: FarmField): string[] {
  const missing: string[] = [];
  if (field.soilType === "unknown") missing.push("Хөрсний төрөл");
  if (field.measuredSoilMoisturePercent === null) missing.push("Хөрсний чийгийн бодит хэмжилт");
  if (!field.lastIrrigationDate) missing.push("Сүүлийн усалгааны огноо");
  if (!field.plantingDate) missing.push("Тариалсан огноо");
  if (field.growthStage === "unknown") missing.push("Ургалтын үе шат");
  return missing;
}

export function buildIrrigationAdvisory(
  scenario: FarmerDemoScenario,
  field: FarmField,
): AdvisoryResult {
  const nextThreeDays = scenario.days.slice(0, 3);
  const nextThreeRainMm = sumForecastPrecipitation(nextThreeDays);
  const totalRainMm = sumForecastPrecipitation(scenario.days);
  const hotDryDays = scenario.days.filter(
    (day) =>
      day.maximumTemperatureC >= DEMO_SCREENING_RULES.dryHotMaximumC &&
      day.minimumRelativeHumidityPercent < DEMO_SCREENING_RULES.dryHotMinimumHumidityPercent,
  );
  const windyDays = scenario.days.filter(
    (day) => day.maximumWindSpeedMps >= DEMO_SCREENING_RULES.strongWindMps,
  );
  const firstAssessmentDay = scenario.days.find(
    (day) =>
      day.precipitationMm <= DEMO_SCREENING_RULES.favorableFieldworkRainMm &&
      day.maximumWindSpeedMps < DEMO_SCREENING_RULES.favorableFieldworkWindMps,
  );
  const missingInputsMn = commonMissingInputs(field);
  const crop = CROP_CONFIG[field.cropType];

  let level: AdvisoryResult["level"] = "insufficient";
  let summaryMn = "Хөрсний чийгийг газар дээр хэмжсэний дараа усалгааны шийдвэр гаргана уу.";
  const explanationMn: string[] = [];

  if (nextThreeRainMm >= DEMO_SCREENING_RULES.wetFieldworkRainMm) {
    level = "watch";
    summaryMn = "Ойрын өдрүүдэд бороотой төлөвтэй. Усалгаанаас өмнө борооны дараах хөрсний чийгийг дахин шалгана уу.";
    explanationMn.push(`Эхний 3 өдрийн interval хур тунадасны нийлбэр ${nextThreeRainMm.toFixed(1)} мм.`);
  } else if (hotDryDays.length > 0 || windyDays.length > 0) {
    level = field.measuredSoilMoisturePercent === null ? "insufficient" : "watch";
    summaryMn = "Хуурайшуулах цаг агаар ажиглагдаж байна. Хөрсний чийг ба ургамлын төлөвийг шалгах цонх гарлаа.";
    explanationMn.push(`${hotDryDays.length} өдөр халуун-хуурай demo screen-д, ${windyDays.length} өдөр салхины screen-д орсон.`);
  } else {
    explanationMn.push("Ойрын хугацаанд бороо, халуун, салхины demo screen онцгой дохио өгөөгүй.");
  }

  if (firstAssessmentDay) {
    explanationMn.push(`Дараагийн тайван, бороо багатай үнэлгээний цонх: ${firstAssessmentDay.validDate}.`);
  }
  explanationMn.push(crop.irrigationNoteMn);

  return {
    category: "irrigation",
    level,
    titleMn: "Хэзээ услах вэ?",
    summaryMn,
    explanationMn,
    supportingMeasurementsMn: [
      `7 хоногийн interval хур тунадасны нийлбэр: ${totalRainMm.toFixed(1)} мм`,
      `Эхний 3 өдрийн хур тунадас: ${nextThreeRainMm.toFixed(1)} мм`,
      field.measuredSoilMoisturePercent === null
        ? "Хөрсний чийг: хэмжилт оруулаагүй"
        : `Хөрсний чийгийн хэрэглэгчийн хэмжилт: ${field.measuredSoilMoisturePercent.toFixed(1)}%`,
      field.measuredRainfallMm === null
        ? "Бодит борооны ажиглалт: оруулаагүй"
        : `Хэрэглэгчийн борооны ажиглалт: ${field.measuredRainfallMm.toFixed(1)} мм`,
    ],
    missingInputsMn,
    validityPeriod: validity(scenario.days),
    sourceMn: "FAO-56-compatible future architecture; одоогоор ET₀, Kc, root-zone water balance тооцоогүй.",
    uncertaintyMn: [
      "Нарны цацраг, өдөр тутмын ET₀, үндэсний гүн, хөрсний ус барих чадвар дутуу.",
      "Хур тунадасны магадлал байхгүй; deterministic demo хэмжээг ашигласан.",
      "Энэ нь услах тушаал эсвэл усны эзлэхүүний тооцоо биш.",
    ],
    isIllustrative: true,
  };
}

export function rankHarvestWeatherWindows(
  scenario: FarmerDemoScenario,
  field: FarmField,
): readonly WeatherWindow[] {
  const maturityConfirmed = field.maturityObservation === "ready";
  return scenario.days
    .map((day, index): WeatherWindow => {
      let score = 0;
      const advantagesMn: string[] = [];
      const concernsMn: string[] = [];
      const previousRain = index > 0 ? scenario.days[index - 1]?.precipitationMm ?? 0 : 0;

      if (day.precipitationMm <= 0.5) {
        score += 3;
        advantagesMn.push("Тухайн өдрийн хур тунадас бага.");
      } else if (day.precipitationMm <= 2) {
        score += 1;
        concernsMn.push("Бага хэмжээний хур тунадасны demo утгатай.");
      } else {
        score -= 3;
        concernsMn.push("Талбайн ажилд саад болж болох бороотой.");
      }

      if (day.maximumWindSpeedMps < 6) {
        score += 2;
        advantagesMn.push("Салхи харьцангуй тогтуун.");
      } else if (day.maximumWindSpeedMps >= DEMO_SCREENING_RULES.strongWindMps) {
        score -= 2;
        concernsMn.push("Хүчтэй салхины demo screen-д орсон.");
      }

      if (day.minimumTemperatureC > DEMO_SCREENING_RULES.frostConcernAirTemperatureC) {
        score += 1;
      } else {
        score -= 2;
        concernsMn.push("Хүйтрэл/хярууны боломжийг талбай дээр шалгана.");
      }

      if (day.maximumTemperatureC >= 12 && day.maximumTemperatureC <= 28) {
        score += 1;
        advantagesMn.push("Өдрийн температур талбайн ажилд харьцуулахад боломжийн.");
      }
      if (previousRain >= DEMO_SCREENING_RULES.wetFieldworkRainMm) {
        score -= 1;
        concernsMn.push("Өмнөх өдрийн борооны дараах хөрсний нойтон байдал тодорхойгүй.");
      }
      if (!maturityConfirmed) {
        concernsMn.push("Ургацын боловсролт баталгаажаагүй.");
      }

      return {
        date: day.validDate,
        score,
        level: score >= 5 ? "favorable" : score >= 2 ? "watch" : "avoid",
        advantagesMn,
        concernsMn,
        maturityConfirmed,
      };
    })
    .sort((left, right) => right.score - left.score || left.date.localeCompare(right.date));
}

export function buildHarvestAdvisory(
  scenario: FarmerDemoScenario,
  field: FarmField,
): AdvisoryResult {
  const windows = rankHarvestWeatherWindows(scenario, field);
  const best = windows[0];
  const crop = CROP_CONFIG[field.cropType];
  const maturityConfirmed = field.maturityObservation === "ready";

  return {
    category: "harvest",
    level: maturityConfirmed && best?.level === "favorable" ? "favorable" : "watch",
    titleMn: "Хэзээ ургацаа хураах вэ?",
    summaryMn: best
      ? `${best.date} нь цаг агаарын хувьд хамгийн өндөр харьцуулалтын оноотой. ${maturityConfirmed ? "Болцын ажиглалтыг хэрэглэгч бэлэн гэж тэмдэглэсэн." : "Ургацын боловсролт баталгаажаагүй."}`
      : "Харьцуулах өдөр олдсонгүй.",
    explanationMn: [
      "Энэ нь зөвхөн 7 хоногийн цаг агаарын талбайн ажлын цонхыг эрэмбэлсэн.",
      crop.harvestMaturityNoteMn,
    ],
    supportingMeasurementsMn: windows.slice(0, 3).map(
      (window) => `${window.date}: weather-window score ${window.score}`,
    ),
    missingInputsMn: maturityConfirmed
      ? ["Талбайн хөрсний даац/нойтон байдал", "Бүтээгдэхүүний лабораторийн эсвэл талбайн чанарын шалгалт"]
      : ["Ургацын боловсролтын баталгаажсан ажиглалт", "Талбайн хөрсний даац/нойтон байдал"],
    validityPeriod: validity(scenario.days),
    sourceMn: "Tsag-uur deterministic weather-window comparator; crop maturity model биш.",
    uncertaintyMn: [
      "Цаг агаар дангаараа ургац хураах бэлэн байдлыг тодорхойлохгүй.",
      "Өмнөх борооны дараах хөрсний бодит төлөв хэмжигдээгүй.",
    ],
    isIllustrative: true,
  };
}

export function buildPlantingAdvisory(
  scenario: FarmerDemoScenario,
  field: FarmField,
): AdvisoryResult {
  const lowTemperatureDays = scenario.days.filter(
    (day) => day.minimumTemperatureC <= DEMO_SCREENING_RULES.frostConcernAirTemperatureC,
  );
  const wetDays = scenario.days.filter(
    (day) => day.precipitationMm >= DEMO_SCREENING_RULES.wetFieldworkRainMm,
  );
  return {
    category: "planting",
    level: "insufficient",
    titleMn: "Тариалалтын цаг агаарын цонх",
    summaryMn: "Хөрсний температур, талбайн чийг ба таримлын соёололтын шаардлагагүйгээр тариалах бэлэн байдлыг батлах боломжгүй.",
    explanationMn: [
      `${lowTemperatureDays.length} өдөр хүйтрэл/хярууны demo screen-д орсон.`,
      `${wetDays.length} өдөр талбайн ажилд нойтон байж болох screen-д орсон.`,
      CROP_CONFIG[field.cropType].descriptionMn,
    ],
    supportingMeasurementsMn: [
      `7 хоногийн хур тунадас: ${sumForecastPrecipitation(scenario.days).toFixed(1)} мм`,
    ],
    missingInputsMn: ["Хөрсний температур", "Соёололтын crop-specific шаардлага", "Хөрсний бодит чийг", "Талбайн даац"],
    validityPeriod: validity(scenario.days),
    sourceMn: "Цаг агаарын demo screen; тариалалтын агрономийн баталгаажсан зөвлөмж биш.",
    uncertaintyMn: ["Бүс нутгийн сорт, хөрс, тариалалтын технологийн мэдээлэл дутуу."],
    isIllustrative: true,
  };
}

export function buildFieldworkAdvisory(
  scenario: FarmerDemoScenario,
): AdvisoryResult {
  const candidates = scenario.days.filter(
    (day) =>
      day.precipitationMm <= DEMO_SCREENING_RULES.favorableFieldworkRainMm &&
      day.maximumWindSpeedMps < DEMO_SCREENING_RULES.favorableFieldworkWindMps &&
      day.minimumTemperatureC > DEMO_SCREENING_RULES.frostConcernAirTemperatureC,
  );
  return {
    category: "fieldwork",
    level: candidates.length > 0 ? "favorable" : "watch",
    titleMn: "Талбайн ажлын төлөвлөгч",
    summaryMn: candidates.length > 0
      ? `${candidates.length} өдөр цаг агаарын demo screen-ээр харьцангуй боломжтой.`
      : "Одоогийн 7 хоногт бүх screen-ийг зэрэг хангах өдөр алга.",
    explanationMn: candidates.map((day) => `${day.validDate}: бороо ${day.precipitationMm.toFixed(1)} мм, салхи ${day.maximumWindSpeedMps.toFixed(1)} м/с.`),
    supportingMeasurementsMn: [
      `7 хоногийн хур тунадас: ${sumForecastPrecipitation(scenario.days).toFixed(1)} мм`,
    ],
    missingInputsMn: ["Хөрсний даац", "Техникийн нөхцөл", "Талбайн бодит гадаргын төлөв"],
    validityPeriod: validity(scenario.days),
    sourceMn: "Tsag-uur deterministic fieldwork screen.",
    uncertaintyMn: ["Талбайн бодит нойтон байдал болон замын нөхцөл агуулаагүй."],
    isIllustrative: true,
  };
}

export function assessAgriculturalRisks(
  scenario: FarmerDemoScenario,
): readonly AgriculturalRisk[] {
  const frostDays = scenario.days.filter(
    (day) => day.minimumTemperatureC <= DEMO_SCREENING_RULES.frostConcernAirTemperatureC,
  );
  const windDays = scenario.days.filter(
    (day) => day.maximumWindSpeedMps >= DEMO_SCREENING_RULES.strongWindMps,
  );
  const rainDays = scenario.days.filter(
    (day) => day.precipitationMm >= DEMO_SCREENING_RULES.heavyDailyRainMm,
  );
  const dryHotDays = scenario.days.filter(
    (day) =>
      day.maximumTemperatureC >= DEMO_SCREENING_RULES.dryHotMaximumC &&
      day.minimumRelativeHumidityPercent < DEMO_SCREENING_RULES.dryHotMinimumHumidityPercent,
  );
  const snowColdDays = scenario.days.filter(
    (day) => day.condition === "snow" || day.minimumTemperatureC < 0,
  );
  const poorFieldworkDays = scenario.days.filter(
    (day) =>
      day.precipitationMm >= DEMO_SCREENING_RULES.wetFieldworkRainMm ||
      day.maximumWindSpeedMps >= DEMO_SCREENING_RULES.strongWindMps,
  );

  const risk = (
    kind: AgriculturalRisk["kind"],
    labelMn: string,
    days: readonly AgriculturalForecastDay[],
    valueMn: string,
    explanationMn: string,
    sourceMn: string,
    limitationMn: string,
  ): AgriculturalRisk => ({
    kind,
    level: days.length === 0 ? "favorable" : days.length >= 2 ? "avoid" : "watch",
    labelMn,
    valueMn,
    explanationMn,
    affectedDates: days.map((day) => day.validDate),
    sourceMn,
    limitationMn,
  });

  return [
    risk(
      "frost",
      "Хярууны боломжит нөхцөл",
      frostDays,
      `${frostDays.length} өдөр`,
      "2 м-ийн minimum air temperature demo screen; баталгаатай хяруу гэсэн үг биш.",
      "FAO Frost Protection Guide: ургамлын температур агаарын температураас өөр байж болно.",
      "Навч/гадаргын температур, шүүдрийн цэг, нойтон булцууны температур байхгүй.",
    ),
    risk("strong-wind", "Хүчтэй салхи", windDays, `${windDays.length} өдөр`, "Шүршилт ба талбайн ажилд салхины demo screen ашиглав.", "Tsag-uur illustrative operational screen.", "Албан салхины анхааруулга биш."),
    risk("heavy-rain", "Их бороо", rainDays, `${rainDays.length} өдөр`, "Өдрийн interval хур тунадасны хэмжээг харьцуулсан.", "Tsag-uur interval-precipitation screen.", "Үер, ус тогтох эрсдэлд хөрс ба газрын хэлбэр ороогүй."),
    risk("dry-hot", "Хуурай, халуун", dryHotDays, `${dryHotDays.length} өдөр`, "Температур ба minimum humidity-ийн хосолсон demo screen.", "Tsag-uur illustrative screen; ET₀ calculation биш.", "Нарны цацраг болон хөрсний усны баланс байхгүй."),
    risk("snow-cold", "Цас ба улирлын хүйтрэл", snowColdDays, `${snowColdDays.length} өдөр`, "Цасны condition эсвэл 0°C-ээс доош minimum air temperature-ийг харьцуулсан.", "Tsag-uur synthetic condition field.", "Цасан бүрхүүл, хөрсний температур байхгүй."),
    risk("fieldwork", "Талбайн ажилд таагүй", poorFieldworkDays, `${poorFieldworkDays.length} өдөр`, "Бороо эсвэл салхины demo screen-д орсон өдрүүд.", "Tsag-uur deterministic fieldwork screen.", "Хөрсний даац, техник, замын нөхцөл байхгүй."),
  ];
}
