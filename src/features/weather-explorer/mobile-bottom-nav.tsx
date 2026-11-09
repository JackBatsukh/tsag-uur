import { SpriteIcon } from "@/components/sprite-icon";

import { LayersIcon, LiteIcon, MapPinIcon } from "./explorer-icons";

interface MobileBottomNavProps {
  readonly sidebarOpen: boolean;
  readonly pointPanelOpen: boolean;
  readonly liteMode: boolean;
  readonly onLayersToggle: () => void;
  readonly onPointPanelToggle: () => void;
  readonly onLiteModeToggle: () => void;
}

function MapIcon() {
  return <SpriteIcon name="map" />;
}

export function MobileBottomNav({
  sidebarOpen,
  pointPanelOpen,
  liteMode,
  onLayersToggle,
  onPointPanelToggle,
  onLiteModeToggle,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Газрын зургийн үндсэн үйлдэл">
      <button type="button" className="mobile-bottom-nav__item" aria-current="page">
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <MapIcon />
        </span>
        <span>Зураг</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={sidebarOpen}
        aria-controls="explorer-sidebar"
        onClick={onLayersToggle}
      >
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <LayersIcon />
        </span>
        <span>Давхарга</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={pointPanelOpen}
        aria-controls="selected-weather-content"
        onClick={onPointPanelToggle}
      >
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <MapPinIcon />
        </span>
        <span>Сонгосон цэг</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={liteMode}
        onClick={onLiteModeToggle}
      >
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <LiteIcon />
        </span>
        <span>Lite</span>
      </button>
    </nav>
  );
}
