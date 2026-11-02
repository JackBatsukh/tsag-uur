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
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 4v13.5M15.5 6.5V20" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
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
        <MapIcon />
        <span>Зураг</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={sidebarOpen}
        aria-controls="explorer-sidebar"
        onClick={onLayersToggle}
      >
        <LayersIcon />
        <span>Давхарга</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={pointPanelOpen}
        aria-controls="selected-weather-content"
        onClick={onPointPanelToggle}
      >
        <MapPinIcon />
        <span>Сонгосон цэг</span>
      </button>
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-pressed={liteMode}
        onClick={onLiteModeToggle}
      >
        <LiteIcon />
        <span>Lite</span>
      </button>
    </nav>
  );
}
