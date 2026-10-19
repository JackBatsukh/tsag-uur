import type {
  WeatherDataProvider,
  WeatherGrid,
  WeatherLayerId,
  WeatherSample,
  WeatherTimeSelector,
} from "@/features/weather-data";

export type MapCoordinates = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type MapEngineStatus =
  | "idle"
  | "loading"
  | "ready"
  | "webgl-unavailable"
  | "error";

export interface MapStatusDetail {
  readonly status: MapEngineStatus;
  readonly message?: string;
}

/**
 * The map deliberately depends on the smallest useful provider surface.
 * A remote provider can hydrate an in-memory WeatherGrid before returning it;
 * Canvas render loops never call the provider or await network work.
 */
export type MapWeatherDataProvider = Pick<
  WeatherDataProvider,
  "contains" | "getGrid"
>;

export interface WeatherMapProps {
  readonly provider: MapWeatherDataProvider;
  readonly activeLayer: WeatherLayerId;
  /** Prefer a stable WeatherTimeStep.id over an array index. */
  readonly timeSelector: WeatherTimeSelector;
  readonly selectedCoordinates: MapCoordinates | null;
  readonly onSelectCoordinates: (coordinates: MapCoordinates) => void;
  readonly liteMode?: boolean;
  readonly showWindParticles?: boolean;
  readonly className?: string;
  readonly onMapStatusChange?: (detail: MapStatusDetail) => void;
}

export type WeatherGridSampler = (
  latitude: number,
  longitude: number,
) => WeatherSample | null;

export interface WeatherLayerRenderOptions {
  readonly grid: WeatherGrid;
  readonly layer: WeatherLayerId;
  readonly sample: WeatherGridSampler;
}

export type {
  WeatherGrid,
  WeatherLayerId,
  WeatherSample,
  WeatherTimeSelector,
};
