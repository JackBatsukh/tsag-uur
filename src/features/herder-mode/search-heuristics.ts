import { SPECIES_CONFIG } from "./config.ts";
import type {
  HistoricalWeatherAnalysis,
  HerderWeatherStep,
  MissingLivestockReport,
  SearchAdjustment,
  SearchAreaSuggestion,
  TerrainContext,
} from "./types.ts";

const TERRAIN_DISTANCE_FACTOR: Readonly<Record<TerrainContext, number>> =
  Object.freeze({
    steppe: 1,
    mountain: 0.65,
    "forest-steppe": 0.7,
    gobi: 1.2,
  });

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function formatOne(value: number): string {
  return value.toFixed(1);
}

export function analyzeHistoricalWeather(
  weather: readonly HerderWeatherStep[],
  lastSeenTime: string,
): HistoricalWeatherAnalysis {
  const lastSeenMs = Date.parse(lastSeenTime);
  const missingInputsMn: string[] = [];
  if (!Number.isFinite(lastSeenMs)) {
    missingInputsMn.push("Сүүлд харсан огноо, цаг хүчинтэй биш.");
  }

  const candidates = weather.filter((step) => {
    if (step.period !== "historical") return false;
    const time = Date.parse(step.validTime);
    return Number.isFinite(lastSeenMs) && time >= lastSeenMs;
  });

  if (candidates.length === 0) {
    missingInputsMn.push("Сүүлд харснаас хойших түүхэн цаг агаарын алхам алга.");
    return Object.freeze({
      stepsConsidered: 0,
      startTime: null,
      endTime: null,
      strongestWindMps: null,
      strongestWindTime: null,
      totalPrecipitationMm: null,
      meanWindFlowDirectionDegrees: null,
      eventNotesMn: Object.freeze([]),
      missingInputsMn: Object.freeze(missingInputsMn),
    });
  }

  let strongest = candidates[0]!;
  let totalPrecipitationMm = 0;
  let sumU = 0;
  let sumV = 0;
  const concerns = new Set(candidates.map((step) => step.visibilityConcern));

  for (const step of candidates) {
    if (step.windSpeedMps > strongest.windSpeedMps) strongest = step;
    totalPrecipitationMm += step.precipitationMm;
    sumU += step.windUMps;
    sumV += step.windVMps;
  }

  const eventNotesMn: string[] = [];
  if (strongest.windSpeedMps >= 10.8) {
    eventNotesMn.push(
      `${formatOne(strongest.windSpeedMps)} м/с хүртэл салхитай DEMO үе бүртгэгдсэн.`,
    );
  }
  if (concerns.has("snow")) {
    eventNotesMn.push("Цас ба салхи давхацсан, үзэгдэх орчин муудаж болох DEMO үе байна.");
  }
  if (concerns.has("dust")) {
    eventNotesMn.push("Шороон тоосны DEMO нөхцөл байна; аэрозолын хэмжилтээр баталгаажаагүй.");
  }
  if (concerns.has("rain")) {
    eventNotesMn.push("Их борооны DEMO үе байна; зам, голын гарцын мэдээлэл холбогдоогүй.");
  }

  const magnitude = Math.hypot(sumU, sumV);
  const meanWindFlowDirectionDegrees =
    magnitude < 0.01
      ? null
      : normalizeDegrees((Math.atan2(sumU, sumV) * 180) / Math.PI);

  return Object.freeze({
    stepsConsidered: candidates.length,
    startTime: candidates[0]?.validTime ?? null,
    endTime: candidates[candidates.length - 1]?.validTime ?? null,
    strongestWindMps: strongest.windSpeedMps,
    strongestWindTime: strongest.validTime,
    totalPrecipitationMm: Math.round(totalPrecipitationMm * 10) / 10,
    meanWindFlowDirectionDegrees,
    eventNotesMn: Object.freeze(eventNotesMn),
    missingInputsMn: Object.freeze(missingInputsMn),
  });
}

function destinationPoint(
  latitude: number,
  longitude: number,
  bearingDegrees: number,
  distanceKm: number,
): [number, number] {
  const radiusKm = 6_371.0088;
  const angularDistance = distanceKm / radiusKm;
  const bearing = bearingDegrees * (Math.PI / 180);
  const latitudeRadians = latitude * (Math.PI / 180);
  const longitudeRadians = longitude * (Math.PI / 180);
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) -
        Math.sin(latitudeRadians) * Math.sin(destinationLatitude),
    );
  return [
    (destinationLongitude * 180) / Math.PI,
    (destinationLatitude * 180) / Math.PI,
  ];
}

export function createSearchSector(
  latitude: number,
  longitude: number,
  bearingDegrees: number,
  distanceKm: number,
  widthDegrees = 58,
): readonly [number, number][] {
  const points: [number, number][] = [[longitude, latitude]];
  const segments = 12;
  for (let index = 0; index <= segments; index += 1) {
    const bearing =
      bearingDegrees - widthDegrees / 2 + (widthDegrees * index) / segments;
    points.push(destinationPoint(latitude, longitude, bearing, distanceKm));
  }
  points.push([longitude, latitude]);
  return Object.freeze(points);
}

export function buildSearchAreas(
  report: MissingLivestockReport,
  analysis: HistoricalWeatherAnalysis,
  adjustment: SearchAdjustment,
): readonly SearchAreaSuggestion[] {
  const origin = report.lastKnownLocation;
  if (!origin) return Object.freeze([]);

  const species = SPECIES_CONFIG[report.species];
  const baseDistance =
    species.baseInspectionKm *
    TERRAIN_DISTANCE_FACTOR[report.terrain] *
    Math.min(1.8, Math.max(0.4, adjustment.distanceMultiplier));
  const observedBearing = normalizeDegrees(
    (report.observedDirectionDegrees ??
      report.possibleDirectionDegrees ??
      analysis.meanWindFlowDirectionDegrees ??
      0) + adjustment.bearingShiftDegrees,
  );
  const weatherBearing = normalizeDegrees(
    (analysis.meanWindFlowDirectionDegrees ?? observedBearing + 180) +
      adjustment.bearingShiftDegrees,
  );
  const alternativeBearing = normalizeDegrees(
    (report.possibleDirectionDegrees ?? observedBearing + 95) +
      adjustment.bearingShiftDegrees,
  );

  const sharedLimitations = Object.freeze([
    "Туршилтын хайлтын бүс — баталгаажаагүй.",
    "Энэ нь малын зам мөр, байршлын магадлал эсвэл аюулгүй явах чиглэл биш.",
    "Газрын бартаа, ус, цасны зузаан, хашаа ба замын бодит давхарга байхгүй.",
  ]);

  const area = (
    id: string,
    kind: SearchAreaSuggestion["kind"],
    titleMn: string,
    color: string,
    bearingDegrees: number,
    distanceKm: number,
    reasonsMn: readonly string[],
  ): SearchAreaSuggestion =>
    Object.freeze({
      id,
      kind,
      titleMn,
      color,
      bearingDegrees,
      distanceKm,
      polygon: createSearchSector(
        origin.latitude,
        origin.longitude,
        bearingDegrees,
        distanceKm,
      ),
      reasonsMn: Object.freeze([...reasonsMn]),
      limitationsMn: sharedLimitations,
    });

  return Object.freeze([
    area(
      "reported-direction",
      "observation",
      "Малчны ажиглалтыг эхэлж шалгах",
      "#f59e0b",
      observedBearing,
      baseDistance * 0.8,
      [
        report.observedDirectionDegrees === null
          ? "Харагдсан чиглэл оруулаагүй тул боломжит чиглэл эсвэл ойрын жишгийг ашиглав."
          : `Сүүлд ажигласан ${Math.round(report.observedDirectionDegrees)}° чиглэлийг ашиглав.`,
        species.inspectionNoteMn,
      ],
    ),
    area(
      "weather-pressure",
      "weather",
      "Салхины нөлөөгөөр давхар шалгах",
      "#2563eb",
      weatherBearing,
      baseDistance,
      [
        analysis.meanWindFlowDirectionDegrees === null
          ? "Түүхэн дундаж салхины урсгал байхгүй; эсрэг чиглэлийн хувилбар харуулав."
          : `Түүхэн U/V векторын дундаж урсгал ${Math.round(weatherBearing)}° чиглэлтэй.`,
        "Салхи нь хөдөлгөөнд нөлөөлж болох нэг хүчин зүйл; мал заавал салхи дагана гэж үзээгүй.",
      ],
    ),
    area(
      "alternative-check",
      "alternative",
      "Өөр хувилбараар шалгах",
      "#0f766e",
      alternativeBearing,
      baseDistance * 0.65,
      [
        report.possibleDirectionDegrees === null
          ? "Малчны боломжит чиглэл байхгүй тул хөндлөн хувилбар гаргав."
          : `Малчны боломжит ${Math.round(report.possibleDirectionDegrees)}° чиглэлийг тусгав.`,
        report.shelterContext.trim()
          ? `Хоргодох нөхцөлийн тэмдэглэл: ${report.shelterContext.trim()}`
          : "Хоргодох газар, хот айл, хашааны мэдээллийг малчин нэмж засварлах шаардлагатай.",
      ],
    ),
  ]);
}
