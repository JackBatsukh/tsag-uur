import type { Map as MapLibreMap } from "maplibre-gl";

import { sampleWeatherGrid } from "@/features/weather-data";
import type {
  WeatherGrid,
  WeatherLayerId,
} from "@/features/weather-data";

import {
  colorForWeatherSample,
  colorScaleForWeatherLayer,
} from "./color-scales";
import type {
  WeatherOverlayRequest,
  WeatherOverlayResponse,
} from "./weather-overlay-protocol";

const SIMULATION_SECONDS_PER_REAL_SECOND = 24_000;
const INITIAL_PARTICLE_ZOOM = 4.1;

interface RenderingProfile {
  readonly frameIntervalMs: number;
  readonly maxDevicePixelRatio: number;
  readonly overlaySampleSize: number;
  readonly particleDensity: number;
  readonly maximumParticles: number;
}

function renderingProfile(): RenderingProfile {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  const constrained =
    window.matchMedia("(max-width: 48rem)").matches ||
    cores <= 4 ||
    memory <= 4 ||
    connection?.saveData === true ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "slow-2g";

  if (constrained) {
    return {
      frameIntervalMs: 1_000 / 30,
      maxDevicePixelRatio: 1,
      overlaySampleSize: 10,
      particleDensity: 0.48,
      maximumParticles: 130,
    };
  }

  if (cores >= 8 && memory >= 8) {
    return {
      frameIntervalMs: 1_000 / 60,
      maxDevicePixelRatio: 1.5,
      overlaySampleSize: 6,
      particleDensity: 1,
      maximumParticles: 240,
    };
  }

  return {
    frameIntervalMs: 1_000 / 40,
    maxDevicePixelRatio: 1.25,
    overlaySampleSize: 8,
    particleDensity: 0.72,
    maximumParticles: 180,
  };
}

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
  sampleSize = 8,
): void {
  fitCanvas(canvas);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const sampleWidth = Math.max(
    1,
    Math.ceil(canvas.clientWidth / sampleSize),
  );
  const sampleHeight = Math.max(
    1,
    Math.ceil(canvas.clientHeight / sampleSize),
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
        (x + 0.5) * sampleSize,
        (y + 0.5) * sampleSize,
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

function valuesForLayer(
  grid: WeatherGrid,
  layer: WeatherLayerId,
): Float32Array {
  switch (layer) {
    case "temperature":
      return grid.fields.temperatureC;
    case "wind-speed":
      return grid.fields.windSpeedMps;
    case "precipitation":
      return grid.fields.hourlyPrecipitationMm;
    case "humidity":
      return grid.fields.relativeHumidityPercent;
    case "pressure":
      return grid.fields.pressureHpa;
  }
}

function flattenedColorScale(layer: WeatherLayerId): Float32Array {
  const stops = colorScaleForWeatherLayer(layer);
  const flattened = new Float32Array(stops.length * 5);
  stops.forEach((stop, index) => {
    const offset = index * 5;
    flattened[offset] = stop.value;
    flattened[offset + 1] = stop.color[0];
    flattened[offset + 2] = stop.color[1];
    flattened[offset + 3] = stop.color[2];
    flattened[offset + 4] = stop.color[3];
  });
  return flattened;
}

/**
 * Canvas raster coordinator. Geographic projection remains on the MapLibre
 * thread; grid interpolation and colour work run in a Web Worker. The
 * synchronous renderer is the compatibility fallback when module workers are
 * unavailable. Worker requests are coalesced so map movement cannot build an
 * unbounded queue of transferred ArrayBuffers.
 */
export class WeatherOverlayRenderer {
  readonly #map: MapLibreMap;
  readonly #canvas: HTMLCanvasElement;
  readonly #buffer = document.createElement("canvas");
  readonly #sampleSize: number;
  #worker: Worker | null = null;
  #requestId = 0;
  #disposed = false;
  #inFlight = false;
  #pending: Readonly<{ grid: WeatherGrid; layer: WeatherLayerId }> | null = null;

  constructor(map: MapLibreMap, canvas: HTMLCanvasElement) {
    this.#map = map;
    this.#canvas = canvas;
    this.#sampleSize = renderingProfile().overlaySampleSize;
    try {
      this.#worker = new Worker(
        new URL("./weather-overlay.worker.ts", import.meta.url),
        { type: "module", name: "weather-overlay" },
      );
      this.#worker.addEventListener("message", this.#handleMessage);
      this.#worker.addEventListener("error", this.#handleWorkerError);
    } catch {
      this.#worker = null;
    }
  }

  render(grid: WeatherGrid, layer: WeatherLayerId): void {
    if (this.#disposed) return;
    if (!this.#worker) {
      renderWeatherOverlay(this.#map, this.#canvas, grid, layer, this.#sampleSize);
      return;
    }
    if (this.#inFlight) {
      // Map move events can arrive faster than the worker can rasterize. Keep
      // only the newest state so ArrayBuffers cannot queue without bound.
      this.#pending = { grid, layer };
      return;
    }

    fitCanvas(this.#canvas);
    const width = Math.max(
      1,
      Math.ceil(this.#canvas.clientWidth / this.#sampleSize),
    );
    const height = Math.max(
      1,
      Math.ceil(this.#canvas.clientHeight / this.#sampleSize),
    );
    const coordinates = new Float32Array(width * height * 2);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const point = this.#map.unproject([
          (x + 0.5) * this.#sampleSize,
          (y + 0.5) * this.#sampleSize,
        ]);
        const offset = (y * width + x) * 2;
        coordinates[offset] = point.lng;
        coordinates[offset + 1] = point.lat;
      }
    }

    const values = valuesForLayer(grid, layer).slice();
    const colorScale = flattenedColorScale(layer);
    const request: WeatherOverlayRequest = {
      requestId: ++this.#requestId,
      width,
      height,
      layer,
      columns: grid.columns,
      rows: grid.rows,
      west: grid.bounds.west,
      south: grid.bounds.south,
      east: grid.bounds.east,
      north: grid.bounds.north,
      longitudeStep: grid.longitudeStep,
      latitudeStep: grid.latitudeStep,
      coordinates,
      values,
      colorScale,
    };
    this.#inFlight = true;
    try {
      this.#worker.postMessage(request, [
        coordinates.buffer,
        values.buffer,
        colorScale.buffer,
      ]);
    } catch {
      this.#inFlight = false;
      this.#handleWorkerError();
      renderWeatherOverlay(this.#map, this.#canvas, grid, layer, this.#sampleSize);
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#pending = null;
    this.#inFlight = false;
    this.#worker?.removeEventListener("message", this.#handleMessage);
    this.#worker?.removeEventListener("error", this.#handleWorkerError);
    this.#worker?.terminate();
    this.#worker = null;
  }

  readonly #handleMessage = (event: MessageEvent<WeatherOverlayResponse>) => {
    const response = event.data;
    this.#inFlight = false;
    if (this.#disposed || response.requestId !== this.#requestId) return;
    const pending = this.#pending;
    this.#pending = null;
    const context = this.#canvas.getContext("2d", { alpha: true });
    const bufferContext = this.#buffer.getContext("2d", { alpha: true });
    if (context && bufferContext) {
      this.#buffer.width = response.width;
      this.#buffer.height = response.height;
      bufferContext.putImageData(
        new ImageData(
          new Uint8ClampedArray(response.pixels),
          response.width,
          response.height,
        ),
        0,
        0,
      );
      context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        this.#buffer,
        0,
        0,
        this.#canvas.width,
        this.#canvas.height,
      );
    }
    if (pending) this.render(pending.grid, pending.layer);
  };

  readonly #handleWorkerError = () => {
    this.#worker?.terminate();
    this.#worker = null;
    this.#inFlight = false;
    const pending = this.#pending;
    this.#pending = null;
    if (pending && !this.#disposed) {
      renderWeatherOverlay(
        this.#map,
        this.#canvas,
        pending.grid,
        pending.layer,
        this.#sampleSize,
      );
    }
  };
}

interface Particle {
  longitude: number;
  latitude: number;
  age: number;
  maxAge: number;
  generation: number;
  role: "airflow" | "weather";
  phase: number;
  size: number;
}

function fractional(value: number): number {
  return value - Math.floor(value);
}

function deterministicUnit(index: number, generation: number, salt: number): number {
  return fractional(Math.sin(index * 12.9898 + generation * 78.233 + salt) * 43_758.5453);
}

function particleBudget(map: MapLibreMap, profile: RenderingProfile): number {
  const container = map.getContainer();
  const area = container.clientWidth * container.clientHeight;
  // Keep screen-space density calm as users zoom into a smaller geographic
  // area. The old fixed budget made local views look like a wall of wind.
  const zoomScale = 1 / Math.pow(1.28, Math.max(0, map.getZoom() - 4));
  return Math.max(
    24,
    Math.min(
      profile.maximumParticles,
      Math.round((area / 4_800) * profile.particleDensity * zoomScale),
    ),
  );
}

function weatherIntensity(sample: ReturnType<typeof sampleWeatherGrid>): number {
  if (!sample) return 0;
  if (sample.condition === "dusty") {
    return Math.min(1, 0.28 + sample.windSpeedMps / 18);
  }
  if (sample.condition !== "rain" && sample.condition !== "snow") return 0;
  return Math.min(1, 0.22 + sample.hourlyPrecipitationMm / 2.8);
}

function resetParticle(
  particle: Particle,
  index: number,
  map: MapLibreMap,
  grid: WeatherGrid,
): void {
  particle.generation += 1;
  const bounds = map.getBounds();
  const west = Math.max(grid.bounds.west, bounds.getWest());
  const east = Math.min(grid.bounds.east, bounds.getEast());
  const south = Math.max(grid.bounds.south, bounds.getSouth());
  const north = Math.min(grid.bounds.north, bounds.getNorth());
  const safeWest = west < east ? west : grid.bounds.west;
  const safeEast = west < east ? east : grid.bounds.east;
  const safeSouth = south < north ? south : grid.bounds.south;
  const safeNorth = south < north ? north : grid.bounds.north;

  let bestLongitude = safeWest;
  let bestLatitude = safeSouth;
  let bestWeatherIntensity = -1;
  const attempts = particle.role === "weather" ? 9 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const salt = attempt * 23.71;
    const longitude =
      safeWest +
      deterministicUnit(index, particle.generation, 1.7 + salt) *
        (safeEast - safeWest);
    const latitude =
      safeSouth +
      deterministicUnit(index, particle.generation, 9.3 + salt) *
        (safeNorth - safeSouth);
    const intensity = weatherIntensity(
      sampleWeatherGrid(grid, latitude, longitude),
    );
    if (particle.role === "airflow" || intensity > bestWeatherIntensity) {
      bestLongitude = longitude;
      bestLatitude = latitude;
      bestWeatherIntensity = intensity;
    }
  }

  particle.longitude = bestLongitude;
  particle.latitude = bestLatitude;
  particle.maxAge = Math.round(
    58 + deterministicUnit(index, particle.generation, 29.8) * 58,
  );
  particle.age = Math.floor(
    deterministicUnit(index, particle.generation, 17.1) * particle.maxAge,
  );
  particle.phase = deterministicUnit(index, particle.generation, 41.2) * Math.PI * 2;
  particle.size = 0.7 + deterministicUnit(index, particle.generation, 53.9) * 1.15;
}

function createParticles(
  count: number,
  map: MapLibreMap,
  grid: WeatherGrid,
): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const particle: Particle = {
      longitude: 103.8,
      latitude: 46.8,
      age: 0,
      maxAge: 90,
      generation: 0,
      role: index % 5 < 3 ? "airflow" : "weather",
      phase: 0,
      size: 1,
    };
    resetParticle(particle, index, map, grid);
    return particle;
  });
}

function resetParticlePool(
  particles: Particle[],
  count: number,
  map: MapLibreMap,
  grid: WeatherGrid,
): Particle[] {
  while (particles.length < count) {
    particles.push({
      longitude: 103.8,
      latitude: 46.8,
      age: 0,
      maxAge: 90,
      generation: 0,
      role: particles.length % 5 < 3 ? "airflow" : "weather",
      phase: 0,
      size: 1,
    });
  }
  if (particles.length > count) particles.length = count;
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (particle) resetParticle(particle, index, map, grid);
  }
  return particles;
}

export interface WindRendererOptions {
  readonly reducedMotion: boolean;
  readonly enabled: boolean;
}

export class WindParticleRenderer {
  readonly #map: MapLibreMap;
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D | null;
  readonly #profile = renderingProfile();
  readonly #intersectionObserver: IntersectionObserver | null;
  #grid: WeatherGrid;
  #particles: Particle[] = [];
  #frameId: number | null = null;
  #lastFrameTime = 0;
  #enabled: boolean;
  #reducedMotion: boolean;
  #disposed = false;
  #visible = true;

  constructor(
    map: MapLibreMap,
    canvas: HTMLCanvasElement,
    grid: WeatherGrid,
    options: WindRendererOptions,
  ) {
    this.#map = map;
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.#grid = grid;
    this.#enabled = options.enabled;
    this.#reducedMotion = options.reducedMotion;
    this.#particles = createParticles(particleBudget(map, this.#profile), map, grid);
    this.#intersectionObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          const entry = entries[0];
          this.#visible = entry?.isIntersecting ?? true;
          if (this.#visible) this.restart();
          else this.#stopFrame();
        })
      : null;
    this.#intersectionObserver?.observe(canvas);
    document.addEventListener("visibilitychange", this.#handleVisibility);
    this.restart();
  }

  setGrid(grid: WeatherGrid): void {
    this.#grid = grid;
    this.#particles = resetParticlePool(
      this.#particles,
      particleBudget(this.#map, this.#profile),
      this.#map,
      this.#grid,
    );
    if (!this.#reducedMotion) this.#clearCanvas();
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
    fitCanvas(
      this.#canvas,
      Math.min(window.devicePixelRatio || 1, this.#profile.maxDevicePixelRatio),
    );
    this.#particles = resetParticlePool(
      this.#particles,
      particleBudget(this.#map, this.#profile),
      this.#map,
      this.#grid,
    );
    this.restart();
  }

  refreshViewport(): void {
    this.#particles = resetParticlePool(
      this.#particles,
      particleBudget(this.#map, this.#profile),
      this.#map,
      this.#grid,
    );
    this.restart();
  }

  restart(): void {
    this.#stopFrame();
    fitCanvas(
      this.#canvas,
      Math.min(window.devicePixelRatio || 1, this.#profile.maxDevicePixelRatio),
    );
    this.#context?.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    if (!this.#enabled || this.#disposed || !this.#visible || document.hidden) return;
    if (this.#reducedMotion) {
      this.redrawStatic();
      return;
    }
    this.#lastFrameTime = performance.now();
    this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
  }

  redrawStatic(): void {
    if (!this.#enabled || !this.#reducedMotion || this.#disposed) return;
    fitCanvas(
      this.#canvas,
      Math.min(window.devicePixelRatio || 1, this.#profile.maxDevicePixelRatio),
    );
    const context = this.#context;
    if (!context) return;
    const ratio = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
    context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    context.save();
    context.scale(ratio, ratio);
    context.strokeStyle = "rgba(244, 252, 255, 0.76)";
    context.fillStyle = "rgba(244, 252, 255, 0.82)";
    context.lineWidth = 1.1;
    for (let y = 28; y < this.#canvas.clientHeight; y += 58) {
      for (let x = 28; x < this.#canvas.clientWidth; x += 58) {
        const coordinates = this.#map.unproject([x, y]);
        const sample = sampleWeatherGrid(
          this.#grid,
          coordinates.lat,
          coordinates.lng,
        );
        if (!sample) continue;
        const scale = 0.72;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(
          x + sample.windUMps * scale,
          y - sample.windVMps * scale,
        );
        context.stroke();
        if (sample.condition === "snow") {
          context.beginPath();
          context.arc(x, y, 1.7, 0, Math.PI * 2);
          context.fill();
        } else if (sample.condition === "rain") {
          context.beginPath();
          context.moveTo(x - 1, y - 2);
          context.lineTo(x + 1, y + 3);
          context.stroke();
        }
      }
    }
    context.restore();
  }

  dispose(): void {
    this.#disposed = true;
    this.#stopFrame();
    this.#intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.#handleVisibility);
    this.#particles.length = 0;
    this.#canvas.width = 1;
    this.#canvas.height = 1;
  }

  #handleVisibility = (): void => {
    if (document.hidden) {
      this.#stopFrame();
    } else {
      this.restart();
    }
  };

  #clearCanvas(): void {
    this.#context?.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #stopFrame(): void {
    if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
    this.#frameId = null;
  }

  #drawParticle(
    context: CanvasRenderingContext2D,
    particle: Particle,
    previous: { x: number; y: number },
    next: { x: number; y: number },
    sample: NonNullable<ReturnType<typeof sampleWeatherGrid>>,
  ): void {
    const intensity = weatherIntensity(sample);
    // Visual emphasis only; this is not an alert or an official storm
    // classification. Production warning state must come from attributed data.
    const isStorm =
      sample.windSpeedMps >= 9 &&
      (sample.condition === "rain" ||
        sample.condition === "snow" ||
        sample.condition === "dusty");

    if (particle.role === "airflow") {
      const alpha = Math.min(0.68, 0.28 + sample.windSpeedMps / 30);
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const visualLength = Math.min(6.2, 2.4 + sample.windSpeedMps * 0.32);
      context.strokeStyle = `rgba(235, 251, 255, ${alpha})`;
      context.lineWidth = Math.min(1.2, 0.72 + sample.windSpeedMps / 28);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(
        previous.x + (dx / distance) * visualLength,
        previous.y + (dy / distance) * visualLength,
      );
      context.stroke();
      return;
    }

    if (sample.condition === "snow") {
      const radius = particle.size * (isStorm ? 1.25 : 1);
      context.strokeStyle = `rgba(255, 255, 255, ${0.42 + intensity * 0.45})`;
      context.lineWidth = isStorm ? 1.05 : 0.72;
      context.beginPath();
      context.moveTo(next.x - radius, next.y);
      context.lineTo(next.x + radius, next.y);
      context.moveTo(next.x, next.y - radius);
      context.lineTo(next.x, next.y + radius);
      context.stroke();
      return;
    }

    if (sample.condition === "rain") {
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = (isStorm ? 2.4 : 1.45) + intensity * 1.6;
      context.strokeStyle = isStorm
        ? `rgba(215, 238, 255, ${0.52 + intensity * 0.35})`
        : `rgba(150, 218, 255, ${0.34 + intensity * 0.38})`;
      context.lineWidth = isStorm ? 1.45 : 0.9;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(previous.x + dx * length, previous.y + dy * length);
      context.stroke();
      return;
    }

    if (sample.condition === "dusty") {
      context.fillStyle = `rgba(211, 158, 85, ${0.2 + intensity * 0.3})`;
      context.beginPath();
      context.ellipse(
        next.x,
        next.y,
        particle.size * (isStorm ? 2.4 : 1.6),
        particle.size * 0.72,
        Math.atan2(next.y - previous.y, next.x - previous.x),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  #drawFrame(now: number): void {
    if (this.#disposed || !this.#enabled || !this.#visible || document.hidden) return;
    const elapsed = now - this.#lastFrameTime;
    if (elapsed < this.#profile.frameIntervalMs) {
      this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
      return;
    }
    this.#lastFrameTime = now;
    if (this.#map.isMoving()) {
      this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
      return;
    }
    const deltaSeconds = Math.min(elapsed / 1_000, 0.08);
    const context = this.#context;
    if (!context) return;
    const ratio = this.#canvas.width / Math.max(1, this.#canvas.clientWidth);
    context.save();
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    context.restore();
    context.save();
    context.scale(ratio, ratio);
    for (let index = 0; index < this.#particles.length; index += 1) {
      const particle = this.#particles[index];
      if (!particle) continue;
      const sample = sampleWeatherGrid(
        this.#grid,
        particle.latitude,
        particle.longitude,
      );
      if (!sample || particle.age > particle.maxAge) {
        resetParticle(particle, index, this.#map, this.#grid);
        continue;
      }
      const previous = this.#map.project([
        particle.longitude,
        particle.latitude,
      ]);
      // Geographic U/V advection stays faithful to the grid while zoom scaling
      // prevents the same metres-per-second from exploding into huge pixel
      // streaks at street-level zooms.
      const zoomTimeScale = Math.pow(2, INITIAL_PARTICLE_ZOOM - this.#map.getZoom());
      const simulationSeconds =
        deltaSeconds * SIMULATION_SECONDS_PER_REAL_SECOND *
        Math.max(0.018, Math.min(1.65, zoomTimeScale));
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
      if (!isVisible || !this.#grid.metadata.bounds) {
        resetParticle(particle, index, this.#map, this.#grid);
        continue;
      }
      this.#drawParticle(context, particle, previous, next, sample);
    }
    context.restore();
    this.#frameId = requestAnimationFrame((time) => this.#drawFrame(time));
  }
}
