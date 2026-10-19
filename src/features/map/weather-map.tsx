"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";

import type { WeatherGrid, WeatherLayerId } from "@/features/weather-data";

import { createBasemapStyle } from "./basemap-config";
import {
  renderWeatherOverlay,
  WindParticleRenderer,
} from "./canvas-weather-layer";
import type {
  MapEngineStatus,
  MapStatusDetail,
  WeatherMapProps,
} from "./map-engine.types";

const INITIAL_CENTER: [number, number] = [103.8, 46.8];
const INITIAL_ZOOM = 4.1;

export function WeatherMap({
  provider,
  activeLayer,
  timeSelector,
  selectedCoordinates,
  onSelectCoordinates,
  liteMode = false,
  showWindParticles = true,
  className,
  onMapStatusChange,
}: WeatherMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const windRendererRef = useRef<WindParticleRenderer | null>(null);
  const gridRef = useRef<WeatherGrid>(provider.getGrid(timeSelector));
  const activeLayerRef = useRef<WeatherLayerId>(activeLayer);
  const onSelectRef = useRef(onSelectCoordinates);
  const onStatusRef = useRef(onMapStatusChange);
  const showWindParticlesRef = useRef(showWindParticles);
  const [status, setStatus] = useState<MapEngineStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();

  const publishStatus = (detail: MapStatusDetail) => {
    setStatus(detail.status);
    setStatusMessage(detail.message);
    onStatusRef.current?.(detail);
  };

  useEffect(() => {
    onSelectRef.current = onSelectCoordinates;
  }, [onSelectCoordinates]);

  useEffect(() => {
    onStatusRef.current = onMapStatusChange;
  }, [onMapStatusChange]);

  useEffect(() => {
    showWindParticlesRef.current = showWindParticles;
    windRendererRef.current?.setEnabled(showWindParticles);
  }, [showWindParticles]);

  useEffect(() => {
    if (liteMode || !hostRef.current || !overlayRef.current || !particlesRef.current) {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let overlayFrame: number | null = null;
    let reducedMotionQuery: MediaQueryList | null = null;

    publishStatus({ status: "loading", message: "Газрын зураг ачаалж байна…" });

    const initialize = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !hostRef.current || !overlayRef.current || !particlesRef.current) {
          return;
        }
        const capabilityCanvas = document.createElement("canvas");
        if (!capabilityCanvas.getContext("webgl2")) {
          publishStatus({
            status: "webgl-unavailable",
            message: "Энэ төхөөрөмж WebGL 2 дэмжихгүй байна. Lite Mode ашиглана уу.",
          });
          return;
        }

        const map = new maplibre.Map({
          container: hostRef.current,
          style: createBasemapStyle(),
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          minZoom: 3,
          maxZoom: 10,
          maxBounds: [
            [80, 38],
            [128, 56],
          ],
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(
          new maplibre.NavigationControl({
            showCompass: false,
            showZoom: true,
          }),
          "bottom-right",
        );
        map.addControl(
          new maplibre.ScaleControl({ maxWidth: 100, unit: "metric" }),
          "bottom-left",
        );

        const scheduleOverlay = () => {
          if (overlayFrame !== null) cancelAnimationFrame(overlayFrame);
          overlayFrame = requestAnimationFrame(() => {
            if (overlayRef.current && mapRef.current) {
              renderWeatherOverlay(
                mapRef.current,
                overlayRef.current,
                gridRef.current,
                activeLayerRef.current,
              );
              windRendererRef.current?.redrawStatic();
            }
          });
        };

        map.on("load", () => {
          if (disposed || !particlesRef.current) return;
          reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
          windRendererRef.current = new WindParticleRenderer(
            map,
            particlesRef.current,
            gridRef.current,
            {
              enabled: showWindParticlesRef.current,
              reducedMotion: reducedMotionQuery.matches,
            },
          );
          const onMotionChange = (event: MediaQueryListEvent) => {
            windRendererRef.current?.setReducedMotion(event.matches);
          };
          reducedMotionQuery.addEventListener("change", onMotionChange);
          map.once("remove", () => {
            reducedMotionQuery?.removeEventListener("change", onMotionChange);
          });
          scheduleOverlay();
          publishStatus({ status: "ready" });
        });

        map.on("move", scheduleOverlay);
        map.on("resize", () => {
          scheduleOverlay();
          windRendererRef.current?.resize();
        });
        map.on("click", (event) => {
          onSelectRef.current({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          });
        });
        map.on("error", (event) => {
          if (!map.loaded()) return;
          setStatusMessage(
            event.error?.message?.includes("tile")
              ? "Зарим суурь газрын зураг ачаалагдсангүй. Сүлжээгээ шалгана уу."
              : undefined,
          );
        });

        const canvas = map.getCanvas();
        const onContextLost = (event: Event) => {
          event.preventDefault();
          publishStatus({
            status: "webgl-unavailable",
            message: "Графикийн орчин тасарлаа. Lite Mode ашиглана уу.",
          });
        };
        canvas.addEventListener("webglcontextlost", onContextLost);
        map.once("remove", () => {
          canvas.removeEventListener("webglcontextlost", onContextLost);
        });

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(hostRef.current);
      } catch (error) {
        if (disposed) return;
        publishStatus({
          status: "error",
          message:
            error instanceof Error
              ? `Газрын зургийг эхлүүлж чадсангүй: ${error.message}`
              : "Газрын зургийг эхлүүлж чадсангүй.",
        });
      }
    };

    void initialize();

    return () => {
      disposed = true;
      if (overlayFrame !== null) cancelAnimationFrame(overlayFrame);
      resizeObserver?.disconnect();
      windRendererRef.current?.dispose();
      windRendererRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [liteMode, provider]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
    const map = mapRef.current;
    const canvas = overlayRef.current;
    if (map && canvas && map.loaded()) {
      renderWeatherOverlay(map, canvas, gridRef.current, activeLayer);
    }
  }, [activeLayer]);

  useEffect(() => {
    try {
      const grid = provider.getGrid(timeSelector);
      gridRef.current = grid;
      windRendererRef.current?.setGrid(grid);
      const map = mapRef.current;
      const canvas = overlayRef.current;
      if (map && canvas && map.loaded()) {
        renderWeatherOverlay(map, canvas, grid, activeLayerRef.current);
      }
    } catch (error) {
      queueMicrotask(() => {
        publishStatus({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Цагийн алхмын өгөгдлийг харуулж чадсангүй.",
        });
      });
    }
  }, [provider, timeSelector]);

  useEffect(() => {
    const updateMarker = async () => {
      const map = mapRef.current;
      if (!map || !selectedCoordinates) return;
      if (!markerRef.current) {
        const maplibre = await import("maplibre-gl");
        if (!mapRef.current) return;
        const element = document.createElement("div");
        element.className = "selected-location-marker";
        element.setAttribute("aria-hidden", "true");
        markerRef.current = new maplibre.Marker({ element, anchor: "center" });
      }
      markerRef.current
        .setLngLat([selectedCoordinates.longitude, selectedCoordinates.latitude])
        .addTo(map);
      if (!map.getBounds().contains([
        selectedCoordinates.longitude,
        selectedCoordinates.latitude,
      ])) {
        map.easeTo({
          center: [selectedCoordinates.longitude, selectedCoordinates.latitude],
          duration: 500,
        });
      }
    };
    void updateMarker();
  }, [selectedCoordinates]);

  return (
    <section
      className={["weather-map", className].filter(Boolean).join(" ")}
      aria-label="Монгол орны интерактив цаг агаарын demo газрын зураг"
    >
      <div ref={hostRef} className="weather-map__basemap" />
      <canvas ref={overlayRef} className="weather-map__overlay" aria-hidden="true" />
      <canvas ref={particlesRef} className="weather-map__particles" aria-hidden="true" />

      {status !== "ready" ? (
        <div className={`map-state map-state--${status}`} role="status">
          <span className="map-state__spinner" aria-hidden="true" />
          <strong>
            {status === "loading" ? "Газрын зураг ачаалж байна" : "Газрын зураг боломжгүй"}
          </strong>
          {statusMessage ? <p>{statusMessage}</p> : null}
        </div>
      ) : statusMessage ? (
        <p className="map-inline-warning" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
