import type { WeatherLayerId } from "@/features/weather-data";

export interface WeatherOverlayRequest {
  readonly requestId: number;
  readonly width: number;
  readonly height: number;
  readonly layer: WeatherLayerId;
  readonly columns: number;
  readonly rows: number;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
  readonly longitudeStep: number;
  readonly latitudeStep: number;
  readonly coordinates: Float32Array;
  readonly values: Float32Array;
  readonly colorScale: Float32Array;
}

export interface WeatherOverlayResponse {
  readonly requestId: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}
