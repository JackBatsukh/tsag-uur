import type {
  HerderCoordinates,
  HerderHourlyWeather,
  LivestockSearchArea,
  LivestockWeatherAnalysis,
  PastureDirectionId,
  PastureDirectionSummary,
  PasturePriority,
} from "./types.ts";

export const PASTURE_DISTANCE_KM = 12;

export const DIRECTION_META: ReadonlyArray<{
  readonly id: PastureDirectionId;
  readonly labelMn: string;
  readonly bearingDegrees: number;
}> = Object.freeze([
  { id: "north", labelMn: "Хойд", bearingDegrees: 0 },
  { id: "east", labelMn: "Зүүн", bearingDegrees: 90 },
  { id: "south", labelMn: "Өмнөд", bearingDegrees: 180 },
  { id: "west", labelMn: "Баруун", bearingDegrees: 270 },
]);

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function directionalCoordinates(
  origin: HerderCoordinates,
  distanceKm = PASTURE_DISTANCE_KM,
): readonly HerderCoordinates[] {
  const latitudeRadians = (origin.latitude * Math.PI) / 180;
  const latitudeDelta = distanceKm / 111.32;
  const longitudeScale = Math.max(0.2, Math.cos(latitudeRadians));
  const longitudeDelta = distanceKm / (111.32 * longitudeScale);

  return Object.freeze([
    Object.freeze({ latitude: origin.latitude + latitudeDelta, longitude: origin.longitude }),
    Object.freeze({ latitude: origin.latitude, longitude: origin.longitude + longitudeDelta }),
    Object.freeze({ latitude: origin.latitude - latitudeDelta, longitude: origin.longitude }),
    Object.freeze({ latitude: origin.latitude, longitude: origin.longitude - longitudeDelta }),
  ]);
}

export function weatherCodeLabelMn(code: number): string {
  if (code === 0) return "Цэлмэг";
  if (code === 1) return "Ихэнхдээ цэлмэг";
  if (code === 2) return "Үүлэрхэг";
  if (code === 3) return "Бүрхэг";
  if (code === 45 || code === 48) return "Манантай";
  if ([51, 53, 55].includes(code)) return "Шиврээ бороо";
  if ([56, 57].includes(code)) return "Хөлдсөн шиврээ";
  if ([61, 63].includes(code)) return "Бороо";
  if ([65, 80, 81, 82].includes(code)) return "Аадар бороо";
  if ([66, 67].includes(code)) return "Хөлдсөн бороо";
  if ([71, 73, 77, 85].includes(code)) return "Цас";
  if (code === 75 || code === 86) return "Их цас";
  if ([95, 96, 97, 99].includes(code)) return "Аянгатай";
  return "Төлөв тодорхойгүй";
}

export function isSevereWeatherCode(code: number): boolean {
  return [57, 65, 67, 75, 82, 86, 95, 96, 97, 99].includes(code);
}

export function forecastWindowFromTime(
  hourly: readonly HerderHourlyWeather[],
  departureTime: string,
  windowHours = 12,
): readonly HerderHourlyWeather[] {
  if (!departureTime) return hourly.slice(0, windowHours);
  const departureTimestamp = Date.parse(departureTime);
  if (!Number.isFinite(departureTimestamp)) return [];
  const startIndex = hourly.findIndex((hour) => Date.parse(hour.time) >= departureTimestamp);
  return startIndex < 0 ? [] : hourly.slice(startIndex, startIndex + windowHours);
}

export function summarizeDirection(
  id: PastureDirectionId,
  coordinates: HerderCoordinates,
  hours: readonly HerderHourlyWeather[],
  distanceKm = PASTURE_DISTANCE_KM,
): PastureDirectionSummary {
  const meta = DIRECTION_META.find((item) => item.id === id) ?? DIRECTION_META[0]!;
  const availableHours = hours.length > 0 ? hours : [
    {
      time: "",
      temperatureC: 0,
      apparentTemperatureC: 0,
      precipitationMm: 0,
      precipitationProbabilityPercent: 0,
      snowfallCm: 0,
      weatherCode: -1,
      windSpeedMps: 0,
      windDirectionDegrees: 0,
      windGustMps: 0,
      visibilityM: 0,
    },
  ];
  const mostSignificant = [...availableHours].sort((left, right) => {
    const severeDifference = Number(isSevereWeatherCode(right.weatherCode)) - Number(isSevereWeatherCode(left.weatherCode));
    if (severeDifference !== 0) return severeDifference;
    return right.precipitationMm - left.precipitationMm;
  })[0]!;

  return Object.freeze({
    id,
    labelMn: meta.labelMn,
    bearingDegrees: meta.bearingDegrees,
    coordinates,
    distanceKm,
    precipitationTotalMm: round(availableHours.reduce((sum, hour) => sum + hour.precipitationMm, 0)),
    precipitationProbabilityMaxPercent: Math.round(Math.max(...availableHours.map((hour) => hour.precipitationProbabilityPercent))),
    maxWindGustMps: round(Math.max(...availableHours.map((hour) => hour.windGustMps))),
    minApparentTemperatureC: round(Math.min(...availableHours.map((hour) => hour.apparentTemperatureC))),
    maxTemperatureC: round(Math.max(...availableHours.map((hour) => hour.temperatureC))),
    minVisibilityM: Math.round(Math.min(...availableHours.map((hour) => hour.visibilityM))),
    weatherCode: mostSignificant.weatherCode,
  });
}

export function chooseDirection(
  directions: readonly PastureDirectionSummary[],
  priority: PasturePriority,
): PastureDirectionSummary | null {
  if (directions.length === 0) return null;
  return [...directions].sort((left, right) => {
    if (priority === "wind") {
      return left.maxWindGustMps - right.maxWindGustMps ||
        left.precipitationTotalMm - right.precipitationTotalMm;
    }
    if (priority === "precipitation") {
      return left.precipitationTotalMm - right.precipitationTotalMm ||
        left.precipitationProbabilityMaxPercent - right.precipitationProbabilityMaxPercent;
    }
    return right.minApparentTemperatureC - left.minApparentTemperatureC ||
      left.maxWindGustMps - right.maxWindGustMps;
  })[0]!;
}

export function largestSixHourTemperatureDrop(
  hours: readonly HerderHourlyWeather[],
): { readonly amountC: number; readonly time: string } | null {
  if (hours.length < 7) return null;
  let result = { amountC: 0, time: hours[6]!.time };
  for (let index = 6; index < hours.length; index += 1) {
    const drop = hours[index - 6]!.temperatureC - hours[index]!.temperatureC;
    if (drop > result.amountC) result = { amountC: round(drop), time: hours[index]!.time };
  }
  return result;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function destinationPoint(
  origin: HerderCoordinates,
  bearingDegrees: number,
  distanceKm: number,
): [number, number] {
  const earthRadiusKm = 6_371.0088;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (origin.latitude * Math.PI) / 180;
  const longitude = (origin.longitude * Math.PI) / 180;
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
  );
  return [
    (destinationLongitude * 180) / Math.PI,
    (destinationLatitude * 180) / Math.PI,
  ];
}

function sectorPolygon(
  origin: HerderCoordinates,
  bearingDegrees: number,
  distanceKm: number,
  widthDegrees: number,
): readonly [number, number][] {
  const points: [number, number][] = [[origin.longitude, origin.latitude]];
  for (let index = 0; index <= 16; index += 1) {
    const bearing = bearingDegrees - widthDegrees / 2 + (widthDegrees * index) / 16;
    points.push(destinationPoint(origin, bearing, distanceKm));
  }
  points.push([origin.longitude, origin.latitude]);
  return Object.freeze(points);
}

function circlePolygon(
  origin: HerderCoordinates,
  radiusKm: number,
): readonly [number, number][] {
  const points: [number, number][] = [];
  for (let bearing = 0; bearing <= 360; bearing += 15) {
    points.push(destinationPoint(origin, bearing, radiusKm));
  }
  return Object.freeze(points);
}

export function analyzeLivestockWeather(
  hours: readonly HerderHourlyWeather[],
): LivestockWeatherAnalysis | null {
  if (hours.length === 0) return null;
  let vectorX = 0;
  let vectorY = 0;
  let totalWeight = 0;
  let strongest = hours[0]!;
  let totalPrecipitationMm = 0;
  let totalSnowfallCm = 0;
  let minimumVisibilityM = Number.POSITIVE_INFINITY;
  const significantWeatherCodes = new Set<number>();

  for (const hour of hours) {
    if (hour.windGustMps > strongest.windGustMps) strongest = hour;
    totalPrecipitationMm += hour.precipitationMm;
    totalSnowfallCm += hour.snowfallCm;
    minimumVisibilityM = Math.min(minimumVisibilityM, hour.visibilityM);
    if (isSevereWeatherCode(hour.weatherCode) || [45, 48, 71, 73, 77, 85].includes(hour.weatherCode)) {
      significantWeatherCodes.add(hour.weatherCode);
    }

    const downwindBearing = normalizeDegrees(hour.windDirectionDegrees + 180);
    const radians = (downwindBearing * Math.PI) / 180;
    const weatherWeight = Math.max(0.5, hour.windGustMps) *
      (1 + Math.min(1, hour.precipitationMm / 5) + Math.min(1, hour.snowfallCm / 2));
    vectorX += Math.sin(radians) * weatherWeight;
    vectorY += Math.cos(radians) * weatherWeight;
    totalWeight += weatherWeight;
  }

  const magnitude = Math.hypot(vectorX, vectorY);
  const bearing = totalWeight === 0 || magnitude / totalWeight < 0.08
    ? null
    : normalizeDegrees((Math.atan2(vectorX, vectorY) * 180) / Math.PI);
  const notesMn: string[] = [];
  if (totalSnowfallCm > 0) notesMn.push(`Сонгосон хугацаанд ${round(totalSnowfallCm)} см загварын цасны нийлбэр байна.`);
  if (totalPrecipitationMm > 0) notesMn.push(`Нийт ${round(totalPrecipitationMm)} мм тунадасны загварын утга байна.`);
  if (bearing !== null) notesMn.push(`Салхины цаг бүрийн уруудах нөлөөний нийлбэр ${Math.round(bearing)}° чиглэлтэй.`);

  return Object.freeze({
    startTime: hours[0]!.time,
    endTime: hours[hours.length - 1]!.time,
    hoursConsidered: hours.length,
    weatherInfluenceBearingDegrees: bearing,
    strongestWindMps: round(strongest.windGustMps),
    strongestWindTime: strongest.time,
    totalPrecipitationMm: round(totalPrecipitationMm),
    totalSnowfallCm: round(totalSnowfallCm),
    minimumVisibilityM: Number.isFinite(minimumVisibilityM) ? Math.round(minimumVisibilityM) : 0,
    significantWeatherCodes: Object.freeze([...significantWeatherCodes]),
    notesMn: Object.freeze(notesMn),
  });
}

export function buildLivestockSearchAreas(
  origin: HerderCoordinates,
  analysis: LivestockWeatherAnalysis,
  maxSearchKm: number,
  observedDirectionDegrees: number | null,
): readonly LivestockSearchArea[] {
  const distanceKm = Math.min(100, Math.max(1, maxSearchKm));
  const areas: LivestockSearchArea[] = [];
  let order = 1;

  if (observedDirectionDegrees !== null && Number.isFinite(observedDirectionDegrees)) {
    const bearing = normalizeDegrees(observedDirectionDegrees);
    areas.push(Object.freeze({
      id: "reported",
      order: order++,
      labelMn: "Малчны харсан зүг",
      color: "#e49b28",
      bearingDegrees: bearing,
      distanceKm,
      polygon: sectorPolygon(origin, bearing, distanceKm, 46),
      reasonMn: `Сүүлд ажигласан ${Math.round(bearing)}° чиглэлийг эхэлж шалгана.`,
    }));
  }

  if (analysis.weatherInfluenceBearingDegrees !== null) {
    const bearing = analysis.weatherInfluenceBearingDegrees;
    areas.push(Object.freeze({
      id: "weather",
      order: order++,
      labelMn: "Шуурганд уруудсан байж болох",
      color: "#2772b8",
      bearingDegrees: bearing,
      distanceKm,
      polygon: sectorPolygon(origin, bearing, distanceKm, 66),
      reasonMn: `${analysis.hoursConsidered} цагийн салхины уруудах нөлөөгөөр ${Math.round(bearing)}° чиглэлийг давхар шалгана.`,
    }));
    areas.push(Object.freeze({
      id: "alternative",
      order: order++,
      labelMn: "Хөндлөн хувилбар",
      color: "#6f7f75",
      bearingDegrees: normalizeDegrees(bearing + 70),
      distanceKm: round(distanceKm * 0.7),
      polygon: sectorPolygon(origin, normalizeDegrees(bearing + 70), distanceKm * 0.7, 42),
      reasonMn: "Салхи өөрчлөгдсөн эсвэл мал уруудаагүй тохиолдлын нөөц чиглэл.",
    }));
  }

  areas.push(Object.freeze({
    id: "nearby",
    order: order++,
    labelMn: "Сүүлд харсан газрын ойр",
    color: "#2f835d",
    bearingDegrees: null,
    distanceKm: round(Math.min(3, Math.max(0.8, distanceKm * 0.2))),
    polygon: circlePolygon(origin, Math.min(3, Math.max(0.8, distanceKm * 0.2))),
    reasonMn: "Мөр, хашаа, жалга, нөмөр болон айл саахалтын мэдээллийг эндээс эхэлж нягтална.",
  }));

  return Object.freeze(areas.sort((left, right) => left.order - right.order));
}
