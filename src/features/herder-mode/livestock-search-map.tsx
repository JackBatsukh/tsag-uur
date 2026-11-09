"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createBasemapStyle } from "@/features/map/basemap-config";

import type { HerderCoordinates, LivestockSearchArea } from "./types";

interface LivestockSearchMapProps {
  readonly location: HerderCoordinates;
  readonly areas: readonly LivestockSearchArea[];
  readonly onSelectLocation: (coordinates: HerderCoordinates) => void;
}

const SOURCE_ID = "livestock-search-areas";

function featureCollection(areas: readonly LivestockSearchArea[]) {
  return {
    type: "FeatureCollection" as const,
    features: areas.map((area) => ({
      type: "Feature" as const,
      properties: {
        id: area.id,
        order: area.order,
        labelMn: area.labelMn,
        color: area.color,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[...area.polygon]],
      },
    })),
  };
}

export function LivestockSearchMap({
  location,
  areas,
  onSelectLocation,
}: LivestockSearchMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  const initialLocationRef = useRef(location);
  const initialAreasRef = useRef(areas);
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
        maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
        const map = new maplibre.Map({
          container: hostRef.current,
          style: createBasemapStyle(),
          center: [initialLocationRef.current.longitude, initialLocationRef.current.latitude],
          zoom: 9,
          minZoom: 3,
          maxZoom: 15,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: true }), "bottom-right");

        map.once("load", () => {
          if (disposed) return;
          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: featureCollection(initialAreasRef.current),
          });
          map.addLayer({
            id: "livestock-search-fill",
            type: "fill",
            source: SOURCE_ID,
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.2,
            },
          });
          map.addLayer({
            id: "livestock-search-outline",
            type: "line",
            source: SOURCE_ID,
            paint: {
              "line-color": ["get", "color"],
              "line-width": 2.5,
            },
          });

          const markerElement = document.createElement("div");
          markerElement.className = "livestock-last-seen-marker";
          markerElement.setAttribute("aria-label", "Сүүлд харсан цэг");
          markerRef.current = new maplibre.Marker({ element: markerElement })
            .setLngLat([initialLocationRef.current.longitude, initialLocationRef.current.latitude])
            .addTo(map);

          map.on("click", (event) => {
            onSelectRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
          });
          setStatus("ready");
        });
        map.once("error", () => setStatus("error"));
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
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection(areas));
    markerRef.current?.setLngLat([location.longitude, location.latitude]);

    void import("maplibre-gl").then((maplibre) => {
      if (!mapRef.current) return;
      const bounds = new maplibre.LngLatBounds(
        [location.longitude, location.latitude],
        [location.longitude, location.latitude],
      );
      for (const area of areas) {
        for (const point of area.polygon) bounds.extend(point);
      }
      mapRef.current.fitBounds(bounds, { padding: 42, maxZoom: 11, duration: 450 });
    });
  }, [areas, location]);

  return (
    <div className="livestock-search-map">
      <div ref={hostRef} className="livestock-search-map__canvas" aria-label="Мал хайх боломжит бүсийн газрын зураг" />
      <span className="livestock-search-map__hint">Газрын зураг дээр дарж сүүлд харсан цэгийг засна</span>
      {status !== "ready" ? (
        <div className="livestock-search-map__status" role="status">
          {status === "loading" ? "Газрын зураг ачаалж байна…" : "Газрын зураг ачаалсангүй. Доорх чиглэлийн мэдээллийг ашиглана уу."}
        </div>
      ) : null}
    </div>
  );
}
