import type {
  WeatherBounds,
  WeatherCondition,
  WeatherLayerDefinition,
  WeatherModeDefinition,
  WeatherUnits,
  WindDirectionCardinal,
} from "./types";

/** Rectangular working extent around Mongolia; it is not a political boundary. */
export const MONGOLIA_WEATHER_BOUNDS: WeatherBounds = Object.freeze({
  west: 87.5,
  south: 41.3,
  east: 120,
  north: 52.2,
});

export const SYNTHETIC_WEATHER_UNITS: WeatherUnits = Object.freeze({
  temperature: "°C",
  wind: "m/s",
  windDirection: "degrees from true north",
  humidity: "%",
  pressure: "hPa",
  precipitation: "mm/h",
});

export const WEATHER_CONDITION_LABELS_MN: Readonly<
  Record<WeatherCondition, string>
> = Object.freeze({
  clear: "Цэлмэг",
  cloudy: "Үүлэрхэг",
  rain: "Бороо",
  snow: "Цас",
  dusty: "Шороон тоос",
});

export const WIND_DIRECTION_LABELS_MN: Readonly<
  Record<WindDirectionCardinal, string>
> = Object.freeze({
  N: "Х",
  NNE: "ХЗХ",
  NE: "ЗХ",
  ENE: "ЗЗХ",
  E: "З",
  ESE: "ЗЗӨ",
  SE: "ЗӨ",
  SSE: "ӨЗӨ",
  S: "Ө",
  SSW: "ӨБӨ",
  SW: "БӨ",
  WSW: "ББӨ",
  W: "Б",
  WNW: "ББХ",
  NW: "БХ",
  NNW: "ХБХ",
});

export const WEATHER_LAYER_DEFINITIONS: readonly WeatherLayerDefinition[] =
  Object.freeze([
    {
      id: "temperature",
      labelMn: "Температур",
      shortLabelMn: "Темп.",
      field: "temperatureC",
      unit: "°C",
      valueRange: [-24, 18],
      colorStops: [
        { value: -24, color: "#312e81" },
        { value: -14, color: "#2563eb" },
        { value: -5, color: "#38bdf8" },
        { value: 2, color: "#a7f3d0" },
        { value: 9, color: "#fde68a" },
        { value: 18, color: "#f97316" },
      ],
    },
    {
      id: "wind-speed",
      labelMn: "Салхины хурд",
      shortLabelMn: "Салхи",
      field: "windSpeedMps",
      unit: "м/с",
      valueRange: [0, 16],
      colorStops: [
        { value: 0, color: "#dbeafe" },
        { value: 3, color: "#67e8f9" },
        { value: 7, color: "#34d399" },
        { value: 11, color: "#facc15" },
        { value: 16, color: "#f97316" },
      ],
    },
    {
      id: "precipitation",
      labelMn: "Хур тунадас",
      shortLabelMn: "Тунадас",
      field: "hourlyPrecipitationMm",
      unit: "мм/ц",
      valueRange: [0, 4],
      colorStops: [
        { value: 0, color: "#f8fafc" },
        { value: 0.2, color: "#bfdbfe" },
        { value: 1, color: "#60a5fa" },
        { value: 2.2, color: "#2563eb" },
        { value: 4, color: "#312e81" },
      ],
    },
    {
      id: "humidity",
      labelMn: "Харьцангуй чийгшил",
      shortLabelMn: "Чийгшил",
      field: "relativeHumidityPercent",
      unit: "%",
      valueRange: [15, 95],
      colorStops: [
        { value: 15, color: "#fef3c7" },
        { value: 35, color: "#bae6fd" },
        { value: 60, color: "#38bdf8" },
        { value: 80, color: "#2563eb" },
        { value: 95, color: "#312e81" },
      ],
    },
    {
      id: "pressure",
      labelMn: "Далайн түвшний даралт",
      shortLabelMn: "Даралт",
      field: "pressureHpa",
      unit: "гПа",
      valueRange: [992, 1032],
      colorStops: [
        { value: 992, color: "#7c3aed" },
        { value: 1002, color: "#3b82f6" },
        { value: 1012, color: "#22c55e" },
        { value: 1022, color: "#facc15" },
        { value: 1032, color: "#ef4444" },
      ],
    },
  ] satisfies readonly WeatherLayerDefinition[]);

export const WEATHER_MODE_DEFINITIONS: readonly WeatherModeDefinition[] =
  Object.freeze([
    { id: "citizen", labelMn: "Иргэн", available: true },
    { id: "herder", labelMn: "Малчин", available: false },
    { id: "agriculture", labelMn: "Тариаланч", available: false },
    { id: "researcher", labelMn: "Судлаач", available: false },
  ] satisfies readonly WeatherModeDefinition[]);

export const WEATHER_CONDITION_CODE: Readonly<
  Record<WeatherCondition, number>
> = Object.freeze({
  clear: 0,
  cloudy: 1,
  rain: 2,
  snow: 3,
  dusty: 4,
});

const CONDITION_BY_CODE: readonly WeatherCondition[] = [
  "clear",
  "cloudy",
  "rain",
  "snow",
  "dusty",
];

export function decodeWeatherCondition(code: number): WeatherCondition {
  return CONDITION_BY_CODE[code] ?? "cloudy";
}

