"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  syntheticWeatherProvider,
  WEATHER_LAYER_DEFINITIONS,
} from "@/features/weather-data";
import type {
  WeatherCoordinates,
  WeatherLayerId,
} from "@/features/weather-data";
import { DynamicWeatherMap, MAP_LAYER_PRESENTATION } from "@/features/map";

import { DEFAULT_DEMO_LOCATION } from "./explorer-config";
import { ExplorerHeader } from "./explorer-header";
import { ExplorerSidebar } from "./explorer-sidebar";
import { ForecastTimeline } from "./forecast-timeline";
import { LiteMap } from "./lite-map";
import { WeatherPointPanel } from "./weather-point-panel";

const LITE_MODE_STORAGE_KEY = "tsag-uur-lite-mode";
const LITE_MODE_CHANGE_EVENT = "tsag-uur-lite-mode-change";

function subscribeToLiteMode(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LITE_MODE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LITE_MODE_CHANGE_EVENT, callback);
  };
}

function getLiteModeSnapshot(): boolean {
  const savedPreference = window.localStorage.getItem(LITE_MODE_STORAGE_KEY);
  const saveData = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData,
  );
  return savedPreference === null ? saveData : savedPreference === "true";
}

export function WeatherExplorer() {
  const provider = syntheticWeatherProvider;
  const [activeLayer, setActiveLayer] = useState<WeatherLayerId>("temperature");
  const [activeTimeIndex, setActiveTimeIndex] = useState(0);
  const [selectedCoordinates, setSelectedCoordinates] =
    useState<WeatherCoordinates>(DEFAULT_DEMO_LOCATION.coordinates);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const liteMode = useSyncExternalStore(
    subscribeToLiteMode,
    getLiteModeSnapshot,
    () => true,
  );
  const [showWindParticles, setShowWindParticles] = useState(true);
  const [mapStatusMessage, setMapStatusMessage] = useState("");

  const timeStep = provider.timeSteps[activeTimeIndex] ?? provider.timeSteps[0];
  const activeLayerDefinition =
    WEATHER_LAYER_DEFINITIONS.find((layer) => layer.id === activeLayer) ??
    WEATHER_LAYER_DEFINITIONS[0];
  const layerPresentation = MAP_LAYER_PRESENTATION[activeLayer];
  const selectedSample = useMemo(
    () =>
      timeStep
        ? provider.sample(
            selectedCoordinates.latitude,
            selectedCoordinates.longitude,
            timeStep.id,
          )
        : null,
    [provider, selectedCoordinates, timeStep],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setActiveTimeIndex((current) =>
        current >= provider.timeSteps.length - 1 ? 0 : current + 1,
      );
    }, 1_600);
    return () => window.clearInterval(interval);
  }, [isPlaying, provider.timeSteps.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateLiteMode = useCallback((enabled: boolean) => {
    window.localStorage.setItem(LITE_MODE_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event(LITE_MODE_CHANGE_EVENT));
    if (enabled) setIsPlaying(false);
  }, []);

  const handleCoordinateSelection = useCallback(
    (coordinates: WeatherCoordinates) => {
      setSelectedCoordinates(coordinates);
    },
    [],
  );

  if (!timeStep || !activeLayerDefinition) {
    return (
      <main className="explorer-fatal-state">
        <h1>Demo өгөгдлийг эхлүүлж чадсангүй</h1>
        <p>Weather provider-д цагийн алхам эсвэл давхаргын тодорхойлолт алга.</p>
      </main>
    );
  }

  const resolvedLiteMode = liteMode;

  return (
    <main className="weather-explorer">
      <a className="explorer-skip-link" href="#selected-weather-panel">
        Сонгосон цэгийн текстэн мэдээлэл рүү очих
      </a>

      <ExplorerHeader
        onSelectCoordinates={handleCoordinateSelection}
        onRequestMenu={() => setSidebarOpen((current) => !current)}
        activeLayerLabel={activeLayerDefinition.shortLabelMn}
      />

      {/* <div className="synthetic-warning" role="note">
        <strong>DEMO</strong>
        <span>Зохиомол өгөгдөл — бодит цаг агаарын мэдээ биш</span>
        <span className="synthetic-warning__meta">Шинжлэх ухаанаар баталгаажаагүй</span>
      </div> */}

      <div className="explorer-stage">
        <button
          type="button"
          className="sidebar-backdrop"
          data-open={sidebarOpen}
          onClick={() => setSidebarOpen(false)}
          aria-label="Цэс хаах"
          tabIndex={sidebarOpen ? 0 : -1}
        />
        <ExplorerSidebar
          open={sidebarOpen}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          onClose={() => setSidebarOpen(false)}
          liteMode={resolvedLiteMode}
          onLiteModeChange={updateLiteMode}
          showWindParticles={showWindParticles}
          onWindParticlesChange={setShowWindParticles}
        />

        <div className="map-stage">
          {!liteMode ? (
            <DynamicWeatherMap
              provider={provider}
              activeLayer={activeLayer}
              timeSelector={timeStep.id}
              selectedCoordinates={selectedCoordinates}
              onSelectCoordinates={handleCoordinateSelection}
              showWindParticles={showWindParticles}
              onMapStatusChange={(detail) => {
                setMapStatusMessage(detail.message ?? "");
                if (
                  detail.status === "webgl-unavailable" ||
                  detail.status === "error"
                ) {
                  updateLiteMode(true);
                }
              }}
            />
          ) : (
            <LiteMap
              sample={selectedSample}
              activeLayer={activeLayerDefinition}
              onEnableFullMap={() => updateLiteMode(false)}
            />
          )}

          <div className={`weather-effect weather-effect--${selectedSample?.condition ?? "clear"}`} aria-hidden="true" />

          <div className="map-toolbar" aria-label="Газрын зургийн төлөв">
            <span className="map-toolbar__layer">
              <i className={`layer-dot layer-dot--${activeLayer}`} aria-hidden="true" />
              {activeLayerDefinition.labelMn}
            </span>
            <span>·</span>
            <span>{resolvedLiteMode ? "Lite" : "Interactive"}</span>
          </div>

          {!resolvedLiteMode ? (
            <div className="layer-legend" aria-label={`${layerPresentation.labelMn} өнгөний тайлбар`}>
              <div className="layer-legend__heading">
                <strong>{layerPresentation.labelMn}</strong>
                <span>{layerPresentation.unit}</span>
              </div>
              <span className="layer-legend__gradient" style={{ background: layerPresentation.gradient }} />
              <div className="layer-legend__range">
                <span>{layerPresentation.minimum}</span>
                <span>{layerPresentation.maximum}</span>
              </div>
            </div>
          ) : null}

          <div id="selected-weather-panel" className="point-panel-anchor" tabIndex={-1}>
            <WeatherPointPanel
              sample={selectedSample}
              timeStep={timeStep}
              metadata={provider.metadata}
              activeLayer={activeLayerDefinition}
            />
          </div>

          <ForecastTimeline
            timeSteps={provider.timeSteps}
            activeIndex={activeTimeIndex}
            isPlaying={isPlaying}
            onActiveIndexChange={(index) => {
              setActiveTimeIndex(index);
              setIsPlaying(false);
            }}
            onPlayingChange={setIsPlaying}
          />

          <p className="map-screenreader-status" aria-live="polite">
            {mapStatusMessage}
          </p>
        </div>
      </div>
    </main>
  );
}
