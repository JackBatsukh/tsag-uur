import { DatabaseIcon } from "@/components/icons";
import type { ForecastLocation, ModelMetadata } from "@/types/weather";

interface ModelMetadataProps {
  readonly metadata: ModelMetadata;
  readonly location: ForecastLocation;
}

export function ModelMetadataPanel({ metadata, location }: ModelMetadataProps) {
  const details = [
    { label: "Загвар", value: metadata.model },
    { label: "Эх сурвалж", value: metadata.source },
    { label: "Загвар ажилласан", value: metadata.runTimeLabel, dateTime: metadata.runTime },
    { label: "Торын нягтаршил", value: metadata.gridResolution },
    { label: "Сонгосон цэг", value: `${location.gridPoint} · ${location.coordinates}` },
    { label: "Боловсруулалтын хувилбар", value: metadata.processingVersion },
  ] as const;

  return (
    <section className="model-panel" id="model" aria-labelledby="model-title">
      <div className="model-panel__heading">
        <span className="model-panel__icon">
          <DatabaseIcon />
        </span>
        <div>
          <p className="eyebrow">Өгөгдлийн гарал үүсэл</p>
          <h2 id="model-title">Загварын мэдээлэл</h2>
        </div>
        <span className="status-pill">
          <span aria-hidden="true" />
          Demo dataset
        </span>
      </div>

      <dl className="metadata-grid">
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>
              {"dateTime" in detail ? (
                <time dateTime={detail.dateTime}>{detail.value}</time>
              ) : (
                detail.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="model-panel__footer">
        <p>
          Энэ блок нь ирээдүйд WRF/NetCDF боловсруулах pipeline-аас ирэх provenance мэдээллийн
          байрлалыг харуулна.
        </p>
        <a href="#transparency">Хязгаарлалтыг харах →</a>
      </div>
    </section>
  );
}
