/// <reference lib="webworker" />

import type {
  WeatherOverlayRequest,
  WeatherOverlayResponse,
} from "./weather-overlay-protocol";

type Lerp = (start: number, end: number, amount: number) => number;

// Tiny WebAssembly module exporting: f32 lerp(f32 start, f32 end, f32 amount).
// Keeping this kernel dependency-free lets the worker fall back to JavaScript on
// older browsers while moving raster interpolation off the UI thread.
const LERP_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x08, 0x01, 0x60, 0x03, 0x7d, 0x7d, 0x7d, 0x01, 0x7d,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x08, 0x01, 0x04, 0x6c, 0x65, 0x72, 0x70, 0x00, 0x00,
  0x0a, 0x0f, 0x01, 0x0d, 0x00, 0x20, 0x00, 0x20, 0x01, 0x20, 0x00,
  0x93, 0x20, 0x02, 0x94, 0x92, 0x0b,
]);

const javascriptLerp: Lerp = (start, end, amount) =>
  start + (end - start) * amount;

const lerpPromise: Promise<Lerp> = WebAssembly.instantiate(LERP_WASM)
  .then(({ instance }) => {
    const wasmLerp = instance.exports.lerp;
    return typeof wasmLerp === "function" ? (wasmLerp as Lerp) : javascriptLerp;
  })
  .catch(() => javascriptLerp);

function clampIndex(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, value));
}

function bilinearValue(
  request: WeatherOverlayRequest,
  latitude: number,
  longitude: number,
  lerp: Lerp,
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

  return lerp(
    lerp(southwest, southeast, xAmount),
    lerp(northwest, northeast, xAmount),
    yAmount,
  );
}

function writeColor(
  pixels: Uint8ClampedArray,
  pixelIndex: number,
  value: number | null,
  scale: Float32Array,
  lerp: Lerp,
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

  pixels[pixelIndex] = Math.round(lerp(scale[lowerOffset + 1] ?? 0, scale[upperOffset + 1] ?? 0, amount));
  pixels[pixelIndex + 1] = Math.round(lerp(scale[lowerOffset + 2] ?? 0, scale[upperOffset + 2] ?? 0, amount));
  pixels[pixelIndex + 2] = Math.round(lerp(scale[lowerOffset + 3] ?? 0, scale[upperOffset + 3] ?? 0, amount));
  pixels[pixelIndex + 3] = Math.round(lerp(scale[lowerOffset + 4] ?? 0, scale[upperOffset + 4] ?? 0, amount) * 255);
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", async (event: MessageEvent<WeatherOverlayRequest>) => {
  const request = event.data;
  const lerp = await lerpPromise;
  const pixels = new Uint8ClampedArray(request.width * request.height * 4);

  for (let index = 0; index < request.width * request.height; index += 1) {
    const coordinateOffset = index * 2;
    const longitude = request.coordinates[coordinateOffset] ?? Number.NaN;
    const latitude = request.coordinates[coordinateOffset + 1] ?? Number.NaN;
    const value = bilinearValue(request, latitude, longitude, lerp);
    writeColor(pixels, index * 4, value, request.colorScale, lerp);
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
