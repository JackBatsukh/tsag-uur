import Link from "next/link";

import {
  WEATHER_LAYER_DEFINITIONS,
  WEATHER_MODE_DEFINITIONS,
} from "@/features/weather-data";
import type {
  WeatherMetadata,
  WeatherLayerId,
  WeatherUserMode,
} from "@/features/weather-data";

import { CloseIcon, InfoCircleIcon, LiteIcon } from "./explorer-icons";

const MODE_ROUTES: Partial<Record<WeatherUserMode, string>> = {
  citizen: "/",
  herder: "/herder",
  agriculture: "/farmer",
};

interface ExplorerSidebarProps {
  readonly open: boolean;
  readonly activeLayer: WeatherLayerId;
  readonly onLayerChange: (layer: WeatherLayerId) => void;
  readonly onClose: () => void;
  readonly liteMode: boolean;
  readonly onLiteModeChange: (enabled: boolean) => void;
  readonly showWindParticles: boolean;
  readonly onWindParticlesChange: (enabled: boolean) => void;
  readonly metadata: WeatherMetadata;
  readonly dataStatus: "loading" | "live" | "fallback";
}

export function ExplorerSidebar({
  open,
  activeLayer,
  onLayerChange,
  onClose,
  liteMode,
  onLiteModeChange,
  showWindParticles,
  onWindParticlesChange,
  metadata,
  dataStatus,
}: ExplorerSidebarProps) {
  return (
    <aside
      className="explorer-sidebar"
      id="explorer-sidebar"
      data-open={open}
      aria-label="Газрын зургийн тохиргоо"
    >
      <div className="sidebar-heading">
        <div>
          <p>Visualization</p>
          <h2>Цаг агаарын давхарга</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Цэс хаах">
          <CloseIcon />
        </button>
      </div>

      <div className="layer-list" role="group" aria-label="Өгөгдлийн давхарга">
        {WEATHER_LAYER_DEFINITIONS.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className="layer-option"
            aria-pressed={activeLayer === layer.id}
            onClick={() => {
              onLayerChange(layer.id);
              onClose();
            }}
          >
            <span className={`layer-option__symbol layer-option__symbol--${layer.id}`} aria-hidden="true" />
            <span>
              <strong>{layer.labelMn}</strong>
              <small>{layer.unit}</small>
            </span>
            <span className="layer-option__state" aria-hidden="true" />
          </button>
        ))}
        <button className="layer-option" type="button" disabled>
          <span className="layer-option__symbol layer-option__symbol--aqi" aria-hidden="true" />
          <span>
            <strong>Агаарын чанар</strong>
            <small>Өгөгдөл хүлээгдэж байна</small>
          </span>
          <span className="coming-soon">Дараа</span>
        </button>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-section__label">Хэрэглэгчийн горим</p>
        <div className="mode-grid">
          {WEATHER_MODE_DEFINITIONS.map((mode) => {
            const href = MODE_ROUTES[mode.id];
            if (mode.available && href) {
              return (
                <Link
                  key={mode.id}
                  href={href}
                  aria-current={mode.id === "citizen" ? "page" : undefined}
                  onClick={onClose}
                >
                  {mode.labelMn}
                </Link>
              );
            }

            return (
              <button
                type="button"
                key={mode.id}
                disabled
                title="Дараагийн үе шатанд нэвтрүүлнэ"
              >
                {mode.labelMn}
                <small>Дараа</small>
              </button>
            );
          })}
        </div>
        <p className="sidebar-helper">
          Одоогоор Иргэн горим ажиллана. Бусад горимд баталгаажаагүй зөвлөмж харуулахгүй.
        </p>
      </div>

      <div className="sidebar-section sidebar-toggles">
        <label className="toggle-row">
          <span className="toggle-row__icon"><LiteIcon /></span>
          <span>
            <strong>Lite Mode</strong>
            <small>MapLibre, tile, animation ачаалахгүй</small>
          </span>
          <input
            type="checkbox"
            checked={liteMode}
            onChange={(event) => onLiteModeChange(event.target.checked)}
          />
          <span className="toggle-control" aria-hidden="true" />
        </label>
        <label className="toggle-row">
          <span className="toggle-row__icon toggle-row__icon--wind" aria-hidden="true">≈</span>
          <span>
            <strong>Салхины урсгал</strong>
            <small>{metadata.isSynthetic ? "Synthetic U/V vector" : "GFS 10 м U/V vector"}</small>
          </span>
          <input
            type="checkbox"
            checked={showWindParticles}
            onChange={(event) => onWindParticlesChange(event.target.checked)}
            disabled={liteMode}
          />
          <span className="toggle-control" aria-hidden="true" />
        </label>
      </div>

      <div className="sidebar-data-note" data-live={dataStatus === "live"}>
        <InfoCircleIcon />
        <p>
          <strong>{dataStatus === "live" ? "Open-source урьдчилсан төлөв." : "Demo fallback."}</strong>
          {dataStatus === "live" ? " NOAA GFS цэгүүдийг Open-Meteo-оор авч, дэлгэцийн grid дээр интерполяц хийсэн. Албан ёсны сэрэмжлүүлэг биш." : " Live provider ажиллахгүй үед аналитик зохиомол grid ашиглана; бодит шийдвэрт ашиглахгүй."}
          {dataStatus === "live" && metadata.sourceUrl ? <> <a href={metadata.sourceUrl} target="_blank" rel="noreferrer">Эх сурвалж</a></> : null}
        </p>
      </div>

      <div className="sidebar-footer-actions">
        <a href="/dashboard#model">Өгөгдлийн дэлгэрэнгүй</a>
        <button type="button" disabled>Тохиргоо · Дараа</button>
      </div>
    </aside>
  );
}
