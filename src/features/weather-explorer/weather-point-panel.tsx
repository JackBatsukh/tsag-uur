import {
  WEATHER_CONDITION_LABELS_MN,
  WIND_DIRECTION_LABELS_MN,
} from "@/features/weather-data";
import type {
  WeatherLayerDefinition,
  WeatherMetadata,
  WeatherSample,
  WeatherTimeStep,
} from "@/features/weather-data";

import { locationNameForCoordinates } from "./explorer-config";
import { ChevronIcon, InfoCircleIcon, MapPinIcon } from "./explorer-icons";

const oneDecimal = new Intl.NumberFormat("mn-MN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function formatUlaanbaatarTimestamp(isoTimestamp: string): string {
  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) return isoTimestamp;

  const ulat = new Date(timestamp + 8 * 60 * 60 * 1_000);
  const year = ulat.getUTCFullYear();
  const month = String(ulat.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ulat.getUTCDate()).padStart(2, "0");
  const hour = String(ulat.getUTCHours()).padStart(2, "0");
  const minute = String(ulat.getUTCMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

interface WeatherPointPanelProps {
  readonly sample: WeatherSample | null;
  readonly timeStep: WeatherTimeStep;
  readonly metadata: WeatherMetadata;
  readonly activeLayer: WeatherLayerDefinition;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
}

export function WeatherPointPanel({
  sample,
  timeStep,
  metadata,
  activeLayer,
  expanded,
  onExpandedChange,
}: WeatherPointPanelProps) {
  if (!sample) {
    return (
      <section className="point-panel point-panel--empty" aria-live="polite">
        <InfoCircleIcon />
        <div>
          <strong>Цаг агаарын grid-ээс гадуур цэг</strong>
          <p>Монголыг хамарсан тэгш өнцөгт grid дотор цэг сонгоно уу.</p>
        </div>
      </section>
    );
  }

  const conditionLabel = WEATHER_CONDITION_LABELS_MN[sample.condition];

  return (
    <section className="point-panel" data-expanded={expanded} aria-labelledby="point-panel-title" aria-live="polite">
      <div className="point-panel__heading">
        <div className="point-panel__location">
          <MapPinIcon />
          <div>
            <p>Сонгосон {metadata.isSynthetic ? "demo" : "forecast"} цэг</p>
            <h2 id="point-panel-title">
              {locationNameForCoordinates(sample.coordinates)}
            </h2>
          </div>
        </div>
        <div className="point-panel__actions">
          <span className="synthetic-pill" data-live={!metadata.isSynthetic}>{metadata.isSynthetic ? "Synthetic" : "GFS · Open data"}</span>
          <button
            type="button"
            className="point-panel__collapse"
            aria-expanded={expanded}
            aria-controls="selected-weather-content"
            aria-label={expanded ? "Сонгосон цэгийн мэдээллийг хураах" : "Сонгосон цэгийн мэдээллийг нээх"}
            onClick={() => onExpandedChange(!expanded)}
          >
            <ChevronIcon />
          </button>
        </div>
      </div>

      <div id="selected-weather-content" className="point-panel__content" hidden={!expanded}>
      <div className="point-panel__primary">
        <div>
          <strong>{oneDecimal.format(sample.temperatureC)}°</strong>
          <span>{conditionLabel}</span>
        </div>
        <div className={`condition-symbol condition-symbol--${sample.condition}`} aria-hidden="true">
          <span />
        </div>
      </div>

      <dl className="point-metrics">
        <div>
          <dt>Салхи</dt>
          <dd>
            {oneDecimal.format(sample.windSpeedMps)} м/с
            <span>
              {WIND_DIRECTION_LABELS_MN[sample.windDirectionCardinal]} · {Math.round(sample.windDirectionDegrees)}°
            </span>
          </dd>
        </div>
        <div>
          <dt>Хур тунадас</dt>
          <dd>
            {oneDecimal.format(sample.hourlyPrecipitationMm)} мм/ц
            <span>Бороо, цасны усны нийлбэр</span>
          </dd>
        </div>
        <div>
          <dt>Цас</dt>
          <dd>
            {oneDecimal.format(sample.snowfallCm)} см/ц
            <span>Цагийн зузааны эквивалент</span>
          </dd>
        </div>
        <div>
          <dt>Чийгшил</dt>
          <dd>
            {Math.round(sample.relativeHumidityPercent)}%
            <span>Харьцангуй</span>
          </dd>
        </div>
        <div>
          <dt>Даралт</dt>
          <dd>
            {Math.round(sample.pressureHpa)} гПа
            <span>Далайн түвшин</span>
          </dd>
        </div>
      </dl>

      <div className="active-field-row">
        <span>Идэвхтэй давхарга</span>
        <strong>{activeLayer.labelMn}</strong>
      </div>

      <details className="point-metadata">
        <summary>Өгөгдөл ба хүчинтэй хугацаа</summary>
        <dl>
          <div>
            <dt>Хүчинтэй</dt>
            <dd><time dateTime={timeStep.validTime}>{timeStep.labelMn}</time></dd>
          </div>
          <div>
            <dt>Цэг</dt>
            <dd>{sample.coordinates.latitude.toFixed(3)}° N, {sample.coordinates.longitude.toFixed(3)}° E</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{metadata.sourceUrl ? <a href={metadata.sourceUrl} target="_blank" rel="noreferrer">{metadata.model}</a> : metadata.model}</dd>
          </div>
          <div>
            <dt>Татсан</dt>
            <dd><time dateTime={metadata.generatedAt}>{formatUlaanbaatarTimestamp(metadata.generatedAt)} ULAT</time></dd>
          </div>
          <div>
            <dt>Grid</dt>
            <dd>{metadata.gridColumns} × {metadata.gridRows} · ~{metadata.nominalResolutionKm} км</dd>
          </div>
        </dl>
      </details>
      </div>
    </section>
  );
}
