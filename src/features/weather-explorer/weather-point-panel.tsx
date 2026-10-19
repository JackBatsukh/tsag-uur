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
import { InfoCircleIcon, MapPinIcon } from "./explorer-icons";

const oneDecimal = new Intl.NumberFormat("mn-MN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

interface WeatherPointPanelProps {
  readonly sample: WeatherSample | null;
  readonly timeStep: WeatherTimeStep;
  readonly metadata: WeatherMetadata;
  readonly activeLayer: WeatherLayerDefinition;
}

export function WeatherPointPanel({
  sample,
  timeStep,
  metadata,
  activeLayer,
}: WeatherPointPanelProps) {
  if (!sample) {
    return (
      <section className="point-panel point-panel--empty" aria-live="polite">
        <InfoCircleIcon />
        <div>
          <strong>Demo grid-ээс гадуур цэг</strong>
          <p>Монголыг хамарсан тэгш өнцөгт grid дотор цэг сонгоно уу.</p>
        </div>
      </section>
    );
  }

  const conditionLabel = WEATHER_CONDITION_LABELS_MN[sample.condition];

  return (
    <section className="point-panel" aria-labelledby="point-panel-title" aria-live="polite">
      <div className="point-panel__heading">
        <div className="point-panel__location">
          <MapPinIcon />
          <div>
            <p>Сонгосон demo цэг</p>
            <h2 id="point-panel-title">
              {locationNameForCoordinates(sample.coordinates)}
            </h2>
          </div>
        </div>
        <span className="synthetic-pill">Synthetic</span>
      </div>

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
          <dd>{oneDecimal.format(sample.windSpeedMps)} м/с</dd>
          <span>
            {WIND_DIRECTION_LABELS_MN[sample.windDirectionCardinal]} · {Math.round(sample.windDirectionDegrees)}°
          </span>
        </div>
        <div>
          <dt>Хур тунадас</dt>
          <dd>{oneDecimal.format(sample.hourlyPrecipitationMm)} мм/ц</dd>
          <span>Зохиомол утга</span>
        </div>
        <div>
          <dt>Чийгшил</dt>
          <dd>{Math.round(sample.relativeHumidityPercent)}%</dd>
          <span>Харьцангуй</span>
        </div>
        <div>
          <dt>Даралт</dt>
          <dd>{Math.round(sample.pressureHpa)} гПа</dd>
          <span>Далайн түвшин</span>
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
            <dd>{metadata.model}</dd>
          </div>
          <div>
            <dt>Grid</dt>
            <dd>{metadata.gridColumns} × {metadata.gridRows} · ~{metadata.nominalResolutionKm} км</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
