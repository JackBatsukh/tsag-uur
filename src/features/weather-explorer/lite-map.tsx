import type {
  WeatherLayerDefinition,
  WeatherSample,
} from "@/features/weather-data";

import { LiteIcon, MapPinIcon } from "./explorer-icons";

interface LiteMapProps {
  readonly sample: WeatherSample | null;
  readonly activeLayer: WeatherLayerDefinition;
  readonly initializing?: boolean;
  readonly onEnableFullMap: () => void;
}

export function LiteMap({
  sample,
  activeLayer,
  initializing = false,
  onEnableFullMap,
}: LiteMapProps) {
  return (
    <section className="lite-map" aria-labelledby="lite-map-title">
      <div className="lite-map__grid" aria-hidden="true">
        <span className="lite-map__mongolia">MONGOLIA</span>
        {sample ? (
          <span
            className="lite-map__pin"
            style={{
              left: `${((sample.coordinates.longitude - 87.5) / (120 - 87.5)) * 100}%`,
              top: `${100 - ((sample.coordinates.latitude - 41.3) / (52.2 - 41.3)) * 100}%`,
            }}
          />
        ) : null}
      </div>
      <div className="lite-map__content">
        <span className="lite-map__icon"><LiteIcon /></span>
        <p className="eyebrow">Low-bandwidth view</p>
        <h1 id="lite-map-title">
          {initializing ? "Горимыг шалгаж байна" : "Lite Mode идэвхтэй"}
        </h1>
        <p>
          MapLibre, OpenStreetMap tile болон wind animation ачаалаагүй. Текстэн demo мэдээлэл хэвийн ажиллана.
        </p>
        {sample ? (
          <div className="lite-map__selection">
            <MapPinIcon />
            <span>
              {sample.coordinates.latitude.toFixed(3)}° N, {sample.coordinates.longitude.toFixed(3)}° E
              <small>{activeLayer.labelMn} · synthetic</small>
            </span>
          </div>
        ) : null}
        {!initializing ? (
          <button type="button" onClick={onEnableFullMap}>
            Интерактив зураг ачаалах
          </button>
        ) : null}
      </div>
    </section>
  );
}
