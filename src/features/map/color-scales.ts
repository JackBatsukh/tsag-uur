import type {
  WeatherLayerId,
  WeatherSample,
} from "@/features/weather-data";

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

interface NumericColorStop {
  readonly value: number;
  readonly color: Rgba;
}

export interface MapLayerPresentation {
  readonly labelMn: string;
  readonly unit: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly gradient: string;
}

export const MAP_LAYER_PRESENTATION: Readonly<
  Record<WeatherLayerId, MapLayerPresentation>
> = {
  temperature: {
    labelMn: "Температур",
    unit: "°C",
    minimum: -36,
    maximum: 30,
    gradient:
      "linear-gradient(90deg, #3949ab, #4f8fd8, #6fc7d4, #d6e781, #f6bd4a, #e86138, #ad1f45)",
  },
  "wind-speed": {
    labelMn: "Салхины хурд",
    unit: "м/с",
    minimum: 0,
    maximum: 24,
    gradient:
      "linear-gradient(90deg, #d8f0f1, #83c9c8, #3c9ba6, #3972b8, #6c4ca4, #b53870)",
  },
  precipitation: {
    labelMn: "Цагийн хур тунадас",
    unit: "мм/ц",
    minimum: 0,
    maximum: 8,
    gradient:
      "linear-gradient(90deg, rgba(226,245,251,.25), #8dd5ea, #368fce, #5651a8, #a93886)",
  },
  humidity: {
    labelMn: "Харьцангуй чийгшил",
    unit: "%",
    minimum: 10,
    maximum: 100,
    gradient:
      "linear-gradient(90deg, #ede0b5, #bcd6b2, #78c4bd, #4c93bd, #405c9e)",
  },
  pressure: {
    labelMn: "Далайн түвшний даралт",
    unit: "гПа",
    minimum: 970,
    maximum: 1045,
    gradient:
      "linear-gradient(90deg, #744c9e, #607cc0, #73b7c8, #bad7a3, #efd271, #dc805b)",
  },
};

const COLOR_SCALES: Readonly<Record<WeatherLayerId, readonly NumericColorStop[]>> = {
  temperature: [
    { value: -36, color: [57, 73, 171, 0.58] },
    { value: -22, color: [79, 143, 216, 0.56] },
    { value: -8, color: [111, 199, 212, 0.53] },
    { value: 4, color: [214, 231, 129, 0.5] },
    { value: 16, color: [246, 189, 74, 0.53] },
    { value: 26, color: [232, 97, 56, 0.57] },
    { value: 36, color: [173, 31, 69, 0.6] },
  ],
  "wind-speed": [
    { value: 0, color: [216, 240, 241, 0.2] },
    { value: 3, color: [131, 201, 200, 0.4] },
    { value: 7, color: [60, 155, 166, 0.48] },
    { value: 12, color: [57, 114, 184, 0.54] },
    { value: 18, color: [108, 76, 164, 0.58] },
    { value: 26, color: [181, 56, 112, 0.62] },
  ],
  precipitation: [
    { value: 0, color: [226, 245, 251, 0] },
    { value: 0.05, color: [167, 222, 236, 0.28] },
    { value: 0.4, color: [91, 177, 217, 0.48] },
    { value: 1.5, color: [54, 143, 206, 0.58] },
    { value: 4, color: [86, 81, 168, 0.64] },
    { value: 8, color: [169, 56, 134, 0.68] },
  ],
  humidity: [
    { value: 10, color: [237, 224, 181, 0.36] },
    { value: 35, color: [188, 214, 178, 0.4] },
    { value: 58, color: [120, 196, 189, 0.45] },
    { value: 78, color: [76, 147, 189, 0.5] },
    { value: 100, color: [64, 92, 158, 0.56] },
  ],
  pressure: [
    { value: 970, color: [116, 76, 158, 0.48] },
    { value: 985, color: [96, 124, 192, 0.44] },
    { value: 1000, color: [115, 183, 200, 0.4] },
    { value: 1015, color: [186, 215, 163, 0.4] },
    { value: 1030, color: [239, 210, 113, 0.46] },
    { value: 1045, color: [220, 128, 91, 0.52] },
  ],
};

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function interpolateColor(
  start: NumericColorStop,
  end: NumericColorStop,
  value: number,
): Rgba {
  const span = end.value - start.value;
  const amount = span === 0 ? 0 : (value - start.value) / span;

  return [
    Math.round(interpolate(start.color[0], end.color[0], amount)),
    Math.round(interpolate(start.color[1], end.color[1], amount)),
    Math.round(interpolate(start.color[2], end.color[2], amount)),
    interpolate(start.color[3], end.color[3], amount),
  ];
}

function colorFromScale(
  value: number,
  stops: readonly NumericColorStop[],
): Rgba {
  const first = stops[0];
  const last = stops[stops.length - 1];

  if (!first || !last || !Number.isFinite(value)) {
    return [0, 0, 0, 0];
  }

  if (value <= first.value) return first.color;
  if (value >= last.value) return last.color;

  for (let index = 1; index < stops.length; index += 1) {
    const upper = stops[index];
    const lower = stops[index - 1];
    if (upper && lower && value <= upper.value) {
      return interpolateColor(lower, upper, value);
    }
  }

  return last.color;
}

function valueForLayer(
  layer: WeatherLayerId,
  sample: WeatherSample,
): number {
  switch (layer) {
    case "temperature":
      return sample.temperatureC;
    case "wind-speed":
      return sample.windSpeedMps;
    case "precipitation":
      return sample.hourlyPrecipitationMm;
    case "humidity":
      return sample.relativeHumidityPercent;
    case "pressure":
      return sample.pressureHpa;
  }
}

export function colorForWeatherSample(
  layer: WeatherLayerId,
  sample: WeatherSample,
): Rgba {
  return colorFromScale(valueForLayer(layer, sample), COLOR_SCALES[layer]);
}
