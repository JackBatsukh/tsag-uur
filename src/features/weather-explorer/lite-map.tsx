import type {
  WeatherLayerDefinition,
  WeatherMetadata,
  WeatherSample,
} from "@/features/weather-data";

import { LiteIcon, MapPinIcon } from "./explorer-icons";

interface LiteMapProps {
  readonly sample: WeatherSample | null;
  readonly activeLayer: WeatherLayerDefinition;
  readonly initializing?: boolean;
  readonly metadata: WeatherMetadata;
  readonly onEnableFullMap: () => void;
}

function formatUlaanbaatarTimestamp(isoTimestamp: string): string {
  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) return isoTimestamp;
  const local = new Date(timestamp + 8 * 60 * 60 * 1_000);
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  const hour = String(local.getUTCHours()).padStart(2, "0");
  const minute = String(local.getUTCMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

export function LiteMap({
  sample,
  activeLayer,
  initializing = false,
  metadata,
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
          MapLibre, OpenStreetMap tile болон wind animation ачаалаагүй. Текстэн цаг агаарын мэдээлэл хэвийн ажиллана.
        </p>
        <p className="lite-map__freshness">
          Шинэчилсэн: <time dateTime={metadata.generatedAt}>{formatUlaanbaatarTimestamp(metadata.generatedAt)}</time>
          {sample ? (
            <> · Хүчинтэй: <time dateTime={sample.validTime}>{formatUlaanbaatarTimestamp(sample.validTime)}</time></>
          ) : null} ULAT
        </p>
        {sample ? (
          <div className="lite-map__selection">
            <MapPinIcon />
            <span>
              {sample.coordinates.latitude.toFixed(3)}° N, {sample.coordinates.longitude.toFixed(3)}° E
              <small>{activeLayer.labelMn} · {metadata.isSynthetic ? "demo" : "GFS"}</small>
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
