"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";

import { createBasemapStyle } from "@/features/map/basemap-config";
import type { WeatherCoordinates } from "@/features/weather-data";

import type { HerderWeatherStep, SearchAreaSuggestion } from "./types";

interface HerderMapProps {
  readonly location: WeatherCoordinates | null;
  readonly searchAreas: readonly SearchAreaSuggestion[];
  readonly weatherStep: HerderWeatherStep | null;
  readonly speciesLabel: string;
  readonly onSelectLocation: (coordinates: WeatherCoordinates) => void;
}

const SEARCH_SOURCE_ID = "herder-search-areas";
const SEARCH_FILL_LAYER_ID = "herder-search-fill";
const SEARCH_LINE_LAYER_ID = "herder-search-line";
const WEATHER_SOURCE_ID = "herder-weather-point";

function searchFeatureCollection(searchAreas: readonly SearchAreaSuggestion[]) {
  return {
    type: "FeatureCollection" as const,
    features: searchAreas.map((area) => ({
      type: "Feature" as const,
      properties: {
        id: area.id,
        titleMn: area.titleMn,
        color: area.color,
        detailMn: [...area.reasonsMn, ...area.limitationsMn].join("\n"),
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[...area.polygon]],
      },
    })),
  };
}

function weatherFeatureCollection(
  location: WeatherCoordinates | null,
  step: HerderWeatherStep | null,
) {
  return {
    type: "FeatureCollection" as const,
    features:
      location && step
        ? [
            {
              type: "Feature" as const,
              properties: {
                concern: step.visibilityConcern,
                windSpeed: step.windSpeedMps,
              },
              geometry: {
                type: "Point" as const,
                coordinates: [location.longitude, location.latitude],
              },
            },
          ]
        : [],
  };
}

export function HerderMap({
  location,
  searchAreas,
  weatherStep,
  speciesLabel,
  onSelectLocation,
}: HerderMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialLocationRef = useRef(location);
  const initialSearchAreasRef = useRef(searchAreas);
  const initialWeatherStepRef = useRef(weatherStep);
  const locationMarkerRef = useRef<MapLibreMarker | null>(null);
  const windMarkerRef = useRef<MapLibreMarker | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const initialize = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !hostRef.current) return;
        maplibre.setWorkerUrl(
          new URL(
            "maplibre-gl/dist/maplibre-gl-worker.mjs",
            import.meta.url,
          ).toString(),
        );
        const capabilityCanvas = document.createElement("canvas");
        if (!capabilityCanvas.getContext("webgl2")) {
          setStatus("error");
          return;
        }

        const map = new maplibre.Map({
          container: hostRef.current,
          style: createBasemapStyle(),
          center: initialLocationRef.current ? [initialLocationRef.current.longitude, initialLocationRef.current.latitude] : [103.8, 46.8],
          zoom: initialLocationRef.current ? 6 : 4.1,
          minZoom: 3,
          maxZoom: 12,
          maxBounds: [[80, 38], [128, 56]],
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

        map.on("load", () => {
          if (disposed) return;
          map.addSource(SEARCH_SOURCE_ID, {
            type: "geojson",
            data: searchFeatureCollection(initialSearchAreasRef.current),
          });
          map.addLayer({
            id: SEARCH_FILL_LAYER_ID,
            type: "fill",
            source: SEARCH_SOURCE_ID,
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.2,
            },
          });
          map.addLayer({
            id: SEARCH_LINE_LAYER_ID,
            type: "line",
            source: SEARCH_SOURCE_ID,
            paint: {
              "line-color": ["get", "color"],
              "line-width": 2.5,
              "line-dasharray": [2, 1.5],
            },
          });
          map.addSource(WEATHER_SOURCE_ID, {
            type: "geojson",
            data: weatherFeatureCollection(initialLocationRef.current, initialWeatherStepRef.current),
          });
          map.addLayer({
            id: "herder-weather-halo",
            type: "circle",
            source: WEATHER_SOURCE_ID,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 9, 56],
              "circle-color": [
                "match",
                ["get", "concern"],
                "snow", "#93c5fd",
                "dust", "#d6a95f",
                "rain", "#60a5fa",
                "#94a3b8",
              ],
              "circle-opacity": 0.18,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#ffffff",
            },
          });

          map.on("mouseenter", SEARCH_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", SEARCH_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", SEARCH_FILL_LAYER_ID, (event) => {
            const properties = event.features?.[0]?.properties as
              | { titleMn?: string; detailMn?: string }
              | undefined;
            if (!properties) return;
            const content = document.createElement("div");
            content.className = "herder-map-popup";
            const title = document.createElement("strong");
            title.textContent = properties.titleMn ?? "Хайж шалгах бүс";
            const detail = document.createElement("p");
            detail.textContent = properties.detailMn ?? "Тайлбар байхгүй.";
            content.append(title, detail);
            new maplibre.Popup({ closeButton: true, maxWidth: "300px" })
              .setLngLat(event.lngLat)
              .setDOMContent(content)
              .addTo(map);
          });
          map.on("click", (event) => {
            const onArea = map.queryRenderedFeatures(event.point, {
              layers: [SEARCH_FILL_LAYER_ID],
            }).length > 0;
            if (!onArea) {
              onSelectRef.current({
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
              });
            }
          });
          setStatus("ready");
        });
        map.on("error", () => {
          if (!map.loaded()) return;
        });
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(hostRef.current);
      } catch {
        if (!disposed) setStatus("error");
      }
    };
    void initialize();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      locationMarkerRef.current?.remove();
      windMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const update = async () => {
      const map = mapRef.current;
      if (!map || !location || !map.loaded()) return;
      const maplibre = await import("maplibre-gl");
      if (!locationMarkerRef.current) {
        const element = document.createElement("div");
        element.className = "herder-location-marker";
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", "Сүүлд харагдсан газар");
        locationMarkerRef.current = new maplibre.Marker({ element, anchor: "center" });
      }
      locationMarkerRef.current
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);

      if (!windMarkerRef.current) {
        const element = document.createElement("div");
        element.className = "herder-wind-marker";
        element.innerHTML = "<span aria-hidden=\"true\">↑</span>";
        windMarkerRef.current = new maplibre.Marker({ element, anchor: "center" });
      }
      const windElement = windMarkerRef.current.getElement();
      const arrow = windElement.querySelector("span");
      if (arrow instanceof HTMLElement && weatherStep) {
        arrow.style.transform = `rotate(${weatherStep.windDirectionDegrees + 180}deg)`;
        windElement.title = `Салхины урсгал: ${Math.round(weatherStep.windDirectionDegrees + 180) % 360}° · ${weatherStep.windSpeedMps.toFixed(1)} м/с`;
      }
      windMarkerRef.current
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
    };
    void update();
  }, [location, status, weatherStep]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    const searchSource = map.getSource(SEARCH_SOURCE_ID) as GeoJSONSource | undefined;
    searchSource?.setData(searchFeatureCollection(searchAreas));
    const weatherSource = map.getSource(WEATHER_SOURCE_ID) as GeoJSONSource | undefined;
    weatherSource?.setData(weatherFeatureCollection(location, weatherStep));
  }, [location, searchAreas, status, weatherStep]);

  return (
    <section className="herder-map" aria-label={`${speciesLabel} хайх төлөвлөлтийн интерактив зураг`}>
      <div ref={hostRef} className="herder-map__canvas" />
      {status !== "ready" ? (
        <div className="herder-map__state" role="status">
          <strong>{status === "loading" ? "Газрын зураг ачаалж байна…" : "Газрын зураг боломжгүй"}</strong>
          <p>
            {status === "error"
              ? "WebGL эсвэл сүлжээ боломжгүй. Доорх текстэн хайлтын бүсийг ашиглана уу."
              : "MapLibre болон суурь зургийг бэлтгэж байна."}
          </p>
        </div>
      ) : null}
      <div className="herder-map__hint">Газрын зураг дээр дарж сүүлд харагдсан цэгийг засна</div>
    </section>
  );
}
