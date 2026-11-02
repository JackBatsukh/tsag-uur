import type {
  HerderCoordinates,
  HerderHourlyWeather,
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
