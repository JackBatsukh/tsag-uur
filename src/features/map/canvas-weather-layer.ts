import type { Map as MapLibreMap } from "maplibre-gl";

import { sampleWeatherGrid } from "@/features/weather-data";
import type {
  WeatherGrid,
  WeatherLayerId,
} from "@/features/weather-data";

import { colorForWeatherSample } from "./color-scales";

const OVERLAY_SAMPLE_SIZE = 7;
const SIMULATION_SECONDS_PER_REAL_SECOND = 42_000;

function fitCanvas(canvas: HTMLCanvasElement, pixelRatio = 1): void {
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function renderWeatherOverlay(
  map: MapLibreMap,
  canvas: HTMLCanvasElement,
  grid: WeatherGrid,
  layer: WeatherLayerId,
): void {
  fitCanvas(canvas);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const sampleWidth = Math.max(
    1,
    Math.ceil(canvas.clientWidth / OVERLAY_SAMPLE_SIZE),
  );
  const sampleHeight = Math.max(
    1,
    Math.ceil(canvas.clientHeight / OVERLAY_SAMPLE_SIZE),
  );
  const buffer = document.createElement("canvas");
  buffer.width = sampleWidth;
  buffer.height = sampleHeight;
  const bufferContext = buffer.getContext("2d", { alpha: true });
  if (!bufferContext) return;

  const image = bufferContext.createImageData(sampleWidth, sampleHeight);
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const point = map.unproject([
        (x + 0.5) * OVERLAY_SAMPLE_SIZE,
        (y + 0.5) * OVERLAY_SAMPLE_SIZE,
      ]);
      const sample = sampleWeatherGrid(grid, point.lat, point.lng);
      const pixelIndex = (y * sampleWidth + x) * 4;
      if (!sample) {
        image.data[pixelIndex + 3] = 0;
        continue;
      }
      const [red, green, blue, alpha] = colorForWeatherSample(layer, sample);
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = Math.round(alpha * 255);
    }
  }
  bufferContext.putImageData(image, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}

interface Particle {
  longitude: number;
  latitude: number;
  age: number;
  generation: number;
}

function fractional(value: number): number {
  return value - Math.floor(value);
}

function deterministicUnit(index: number, generation: number, salt: number): number {
  return fractional(Math.sin(index * 12.9898 + generation * 78.233 + salt) * 43_758.5453);
}

function particleBudget(map: MapLibreMap): number {
  const container = map.getContainer();
  const area = container.clientWidth * container.clientHeight;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const quality = cores <= 4 || memory <= 4 ? 0.58 : 1;
  return Math.max(110, Math.min(720, Math.round((area / 1_900) * quality)));
}

function resetParticle(
  particle: Particle,
  index: number,
  map: MapLibreMap,
): void {
  particle.generation += 1;
  const bounds = map.getBounds();
  const west = Math.max(87.5, bounds.getWest());
  const east = Math.min(120, bounds.getEast());
  const south = Math.max(41.3, bounds.getSouth());
  const north = Math.min(52.2, bounds.getNorth());
  const safeWest = west < east ? west : 87.5;
  const safeEast = west < east ? east : 120;
  const safeSouth = south < north ? south : 41.3;
  const safeNorth = south < north ? north : 52.2;
  particle.longitude =
    safeWest +
    deterministicUnit(index, particle.generation, 1.7) * (safeEast - safeWest);
  particle.latitude =
    safeSouth +
    deterministicUnit(index, particle.generation, 9.3) * (safeNorth - safeSouth);
  particle.age = Math.floor(
    deterministicUnit(index, particle.generation, 17.1) * 90,
  );
}

function createParticles(count: number, map: MapLibreMap): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const particle: Particle = {
      longitude: 103.8,
      latitude: 46.8,
      age: 0,
      generation: 0,
    };
    resetParticle(particle, index, map);
    return particle;
  });
}

export interface WindRendererOptions {
  readonly reducedMotion: boolean;
  readonly enabled: boolean;
}

export class WindParticleRenderer {
  readonly #map: MapLibreMap;
  readonly #canvas: HTMLCanvasElement;
  #grid: WeatherGrid;
  #particles: Particle[] = [];
  #frameId: number | null = null;
  #lastFrameTime = 0;
  #enabled: boolean;
  #reducedMotion: boolean;
  #disposed = false;

  constructor(
    map: MapLibreMap,
    canvas: HTMLCanvasElement,
    grid: WeatherGrid,
    options: WindRendererOptions,
  ) {
    this.#map = map;
    this.#canvas = canvas;
    this.#grid = grid;
    this.#enabled = options.enabled;
    this.#reducedMotion = options.reducedMotion;
    this.#particles = createParticles(particleBudget(map), map);
    document.addEventListener("visibilitychange", this.#handleVisibility);
    this.restart();
  }

  setGrid(grid: WeatherGrid): void {
    this.#grid = grid;
    this.redrawStatic();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.restart();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.#reducedMotion = reducedMotion;
    this.restart();
  }

  resize(): void {
    fitCanvas(this.#canvas, Math.min(window.devicePixelRatio || 1, 1.5));
    this.#particles = createParticles(particleBudget(this.#map), this.#map);
    this.restart();
  }

  restart(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
    fitCanvas(this.#canvas, Math.min(window.devicePixelRatio || 1, 1.5));
    const context = this.#canvas.getContext("2d");
    context?.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    if (!this.#enabled || this.#disposed) return;
    if (this.#reducedMotion) {
      this.redrawStatic();
      return;
    }
    this.#lastFrameTime = performance.now();
    this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
  }

  redrawStatic(): void {
    if (!this.#enabled || !this.#reducedMotion || this.#disposed) return;
    fitCanvas(this.#canvas, Math.min(window.devicePixelRatio || 1, 1.5));
    const context = this.#canvas.getContext("2d");
    if (!context) return;
    const ratio = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
    context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    context.save();
    context.scale(ratio, ratio);
    context.strokeStyle = "rgba(244, 252, 255, 0.82)";
    context.lineWidth = 1.2;
    for (let latitude = 42; latitude <= 52; latitude += 1.35) {
      for (let longitude = 88; longitude <= 120; longitude += 2.2) {
        const sample = sampleWeatherGrid(this.#grid, latitude, longitude);
        if (!sample) continue;
        const point = this.#map.project([longitude, latitude]);
        if (
          point.x < 0 ||
          point.y < 0 ||
          point.x > this.#canvas.clientWidth ||
          point.y > this.#canvas.clientHeight
        ) {
          continue;
        }
        const scale = 0.65;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(
          point.x + sample.windUMps * scale,
          point.y - sample.windVMps * scale,
        );
        context.stroke();
      }
    }
    context.restore();
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
    document.removeEventListener("visibilitychange", this.#handleVisibility);
  }

  #handleVisibility = (): void => {
    if (document.hidden) {
      if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    } else {
      this.restart();
    }
  };

  #drawFrame(now: number): void {
    if (this.#disposed || !this.#enabled || document.hidden) return;
    const elapsed = now - this.#lastFrameTime;
    if (elapsed < 32) {
      this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
      return;
    }
    this.#lastFrameTime = now;
    const deltaSeconds = Math.min(elapsed / 1_000, 0.08);
    const context = this.#canvas.getContext("2d");
    if (!context) return;
    const ratio = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
    context.save();
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = "rgba(0, 0, 0, 0.9)";
    context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    context.restore();
    context.save();
    context.scale(ratio, ratio);
    context.strokeStyle = "rgba(247, 253, 255, 0.74)";
    context.lineWidth = 0.82;

    this.#particles.forEach((particle, index) => {
      const sample = sampleWeatherGrid(
        this.#grid,
        particle.latitude,
        particle.longitude,
      );
      if (!sample || particle.age > 110) {
        resetParticle(particle, index, this.#map);
        return;
      }
      const previous = this.#map.project([
        particle.longitude,
        particle.latitude,
      ]);
      const simulationSeconds = deltaSeconds * SIMULATION_SECONDS_PER_REAL_SECOND;
      particle.latitude +=
        (sample.windVMps * simulationSeconds) / 111_320;
      particle.longitude +=
        (sample.windUMps * simulationSeconds) /
        (111_320 * Math.max(0.25, Math.cos((particle.latitude * Math.PI) / 180)));
      particle.age += 1;
      const next = this.#map.project([particle.longitude, particle.latitude]);
      const isVisible =
        next.x >= -10 &&
        next.y >= -10 &&
        next.x <= this.#canvas.clientWidth + 10 &&
        next.y <= this.#canvas.clientHeight + 10;
      if (!isVisible || !this.#grid.metadata.bounds || !sample) {
        resetParticle(particle, index, this.#map);
        return;
      }
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    });
    context.restore();
    this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
  }
}
