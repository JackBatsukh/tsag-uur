import type { StyleSpecification } from "maplibre-gl";

export const OSM_TILE_TEMPLATE =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/**
 * OSM Standard is suitable for a modest development demo, not guaranteed
 * production capacity. Keep this isolated so university-hosted vector tiles
 * can replace it without changing the map component.
 */
export function createBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [OSM_TILE_TEMPLATE],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "osm-basemap",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": 0.82,
          "raster-saturation": -0.62,
          "raster-contrast": 0.04,
          "raster-brightness-min": 0.12,
          "raster-brightness-max": 0.96,
        },
      },
    ],
  };
}
