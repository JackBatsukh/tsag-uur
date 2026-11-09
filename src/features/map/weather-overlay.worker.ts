/// <reference lib="webworker" />

import type {
  WeatherOverlayRequest,
  WeatherOverlayResponse,
} from "./weather-overlay-protocol";

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clampIndex(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, value));
}

function bilinearValue(
  request: WeatherOverlayRequest,
  latitude: number,
  longitude: number,
): number | null {
  if (
    latitude < request.south ||
    latitude > request.north ||
    longitude < request.west ||
    longitude > request.east
  ) {
    return null;
  }

  const fractionalColumn = (longitude - request.west) / request.longitudeStep;
  const fractionalRow = (latitude - request.south) / request.latitudeStep;
  const column0 = clampIndex(Math.floor(fractionalColumn), request.columns - 1);
  const row0 = clampIndex(Math.floor(fractionalRow), request.rows - 1);
  const column1 = Math.min(request.columns - 1, column0 + 1);
  const row1 = Math.min(request.rows - 1, row0 + 1);
  const xAmount = Math.min(1, Math.max(0, fractionalColumn - column0));
  const yAmount = Math.min(1, Math.max(0, fractionalRow - row0));
  const southwest = request.values[row0 * request.columns + column0] ?? 0;
  const southeast = request.values[row0 * request.columns + column1] ?? southwest;
  const northwest = request.values[row1 * request.columns + column0] ?? southwest;
  const northeast = request.values[row1 * request.columns + column1] ?? northwest;

  return interpolate(
    interpolate(southwest, southeast, xAmount),
    interpolate(northwest, northeast, xAmount),
    yAmount,
  );
}

function writeColor(
  pixels: Uint8ClampedArray,
  pixelIndex: number,
  value: number | null,
  scale: Float32Array,
): void {
  if (value === null || !Number.isFinite(value) || scale.length < 5) {
    pixels[pixelIndex + 3] = 0;
    return;
  }

  const lastOffset = scale.length - 5;
  let lowerOffset = 0;
  let upperOffset = lastOffset;

  if (value <= (scale[0] ?? 0)) {
    upperOffset = 0;
  } else if (value >= (scale[lastOffset] ?? 0)) {
    lowerOffset = lastOffset;
  } else {
    for (let offset = 5; offset < scale.length; offset += 5) {
      if (value <= (scale[offset] ?? value)) {
        lowerOffset = offset - 5;
        upperOffset = offset;
        break;
      }
    }
  }

  const lowerValue = scale[lowerOffset] ?? value;
  const upperValue = scale[upperOffset] ?? lowerValue;
  const amount = lowerValue === upperValue
    ? 0
    : (value - lowerValue) / (upperValue - lowerValue);

  pixels[pixelIndex] = Math.round(interpolate(scale[lowerOffset + 1] ?? 0, scale[upperOffset + 1] ?? 0, amount));
  pixels[pixelIndex + 1] = Math.round(interpolate(scale[lowerOffset + 2] ?? 0, scale[upperOffset + 2] ?? 0, amount));
  pixels[pixelIndex + 2] = Math.round(interpolate(scale[lowerOffset + 3] ?? 0, scale[upperOffset + 3] ?? 0, amount));
  pixels[pixelIndex + 3] = Math.round(interpolate(scale[lowerOffset + 4] ?? 0, scale[upperOffset + 4] ?? 0, amount) * 255);
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<WeatherOverlayRequest>) => {
  const request = event.data;
  const pixels = new Uint8ClampedArray(request.width * request.height * 4);

  for (let index = 0; index < request.width * request.height; index += 1) {
    const coordinateOffset = index * 2;
    const longitude = request.coordinates[coordinateOffset] ?? Number.NaN;
    const latitude = request.coordinates[coordinateOffset + 1] ?? Number.NaN;
    const value = bilinearValue(request, latitude, longitude);
    writeColor(pixels, index * 4, value, request.colorScale);
  }

  const response: WeatherOverlayResponse = {
    requestId: request.requestId,
    width: request.width,
    height: request.height,
    pixels,
  };
  workerScope.postMessage(response, [pixels.buffer]);
});

export {};
