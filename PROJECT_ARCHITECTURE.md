# PROJECT_ARCHITECTURE.md — Tsag-uur

**Status:** Phase 1 map-first frontend foundation implemented with deterministic synthetic data. Real forecast ingestion and backend services are not implemented yet.
**Budget:** $0 incremental software/service spend for initial development.
**Audience:** Citizens, Mongolian herders, researchers.
**Purpose:** Turn meteorological model outputs into understandable forecasts, explainable risk context, and scientific exploration.

## 1. Differentiation
- **Citizen:** understandable local-grid forecast and hourly trend.
- **Herder:** practical context for wind, temperature, precipitation; risk rules only after domain validation.
- **Researcher:** inspect layers, point series, provenance, and export where permitted.
- **Lite Mode:** low-bandwidth, text-first forecast and graceful degradation.
- **Trust:** always disclose forecast validity, model run, data source, grid resolution, limitations.

## 2. Architecture
```text
Browser (mobile-first)
   | HTTPS
CDN / edge caching (optional free tier)
   |---- Next.js App Router: server components and small client islands
   |---- WeatherDataProvider: synthetic source now, processed forecast source later
   |---- MapLibre GL JS (conditional dynamic import; omitted in Lite Mode)
   |---- Canvas weather raster + U/V wind particle overlay
   |---- cached forecast raster/vector tiles (future)
   |
FastAPI (stateless; future)
   |---- Valkey cache (future)
   |---- PostgreSQL + PostGIS metadata (future)
   |---- versioned processed forecast products (local files / S3-compatible storage)
   |
Offline Python worker (future)
   WRF/NetCDF -> validate -> xarray/NumPy processing -> point series,
   derived variables, geospatial tiles, versioned publication
```
**Critical rule:** Never parse a complete NetCDF file inside a normal web request.

The current browser implementation is intentionally backend-independent. Its typed
`WeatherDataProvider` boundary keeps the UI, map, point sampling, and timeline stable
when the synthetic dataset is replaced by versioned processed WRF products.

## 3. Technology decisions
| Layer | Choice | Timing |
|---|---|---|
| Frontend | Next.js App Router + TypeScript | Now |
| CSS | Tailwind CSS if scaffolded, plus CSS variables/native CSS | Now |
| Interactive maps | MapLibre GL JS, conditionally lazy loaded | Implemented in Phase 1 |
| Weather rendering | Native Canvas raster and U/V particle layer | Implemented in Phase 1 |
| Time-series | lightweight SVG/uPlot as justified | Later |
| API | Python FastAPI + Pydantic | Later |
| Weather ETL | Python xarray, NumPy; Dask only if needed | Later |
| Geospatial | GDAL/Rasterio as needed | Later |
| Database | PostgreSQL/PostGIS | Later |
| Cache | Valkey | Later |
| Background work | offline scripts first; queue only if needed | Later |
| Storage | local filesystem first; S3-compatible later | Later |
| Deployment | Docker Compose on existing hardware | Later |
| Testing | ESLint, TypeScript, Playwright, pytest, k6 as needed | Incremental |
| Observability | structured logs first; OpenTelemetry/Grafana later | Incremental |

No Kubernetes, Kafka, microservice sprawl, heavy 3D, or paid APIs at MVP stage.

## 4. Data and scientific integrity
Initial sample: WRF NetCDF supplied by the university. Confirm metadata and dimensions programmatically before coding assumptions. Treat sample as **historical/demo** unless validated as current.
- Units: `T2` K -> °C; `U10`,`V10` m/s -> wind magnitude/direction; `RAINC`,`RAINNC` cumulative mm -> interval differences after checking run resets.
- Inspect coordinates, projection, time steps, missing values, masks, and spatial resolution.
- Forecast output must carry `model`, `run_time`, `valid_time`, `source`, `units`, `grid_resolution`, and processing version.
- Do not imply a 27 km model grid produces street-level forecast accuracy.
- Scientific warning/decision thresholds require evidence and verification; do not invent official alerts.

## 5. Suggested repository structure (grow gradually)
```text
tsag-uur/
  AGENTS.md
  PROJECT_ARCHITECTURE.md
  public/
  src/
    app/                 # Next.js routes, layouts, server components
    components/          # shared UI and weather presentation
    features/
      map/               # MapLibre adapter, base-map config, Canvas weather rendering
      weather-data/      # provider contract, interpolation, deterministic demo dataset
      weather-explorer/  # map-first UI, controls, timeline, Lite fallback
    lib/                 # typed utilities, API clients
    types/
  services/
    api/                 # future FastAPI service
    weather-worker/      # future offline NetCDF pipeline
  infra/                 # future compose/monitoring
```
Do not create empty directories solely to match this target tree.

## 6. Initial user flows
1. Open the explorer -> Mongolia map, selected synthetic layer, and persistent demo disclosure.
2. Select a known location or click a grid point -> interpolated point conditions and series.
3. Change forecast valid time -> deterministic layer, wind, and point values update together.
4. Use Lite Mode -> no MapLibre JavaScript or base-map tile requests; text/grid fallback remains useful.
5. Open `/dashboard` -> the Phase 1 information-dashboard reference.
6. Citizen mode is active; Herder, Agriculture, and Researcher modes stay visibly unavailable until their workflows are implemented and validated.

### 6.1 Current weather-layer pipeline

```text
Synthetic analytic fields (current)
  -> typed WeatherGrid: temperature, U/V wind, precipitation,
     humidity, pressure, condition
  -> bilinear point sampling
  -> Canvas colour raster + vector-driven wind particles
  -> point panel + hourly timeline

Processed WRF fields (future)
  -> versioned offline conversion and validation
  -> the same WeatherDataProvider contract
  -> pre-generated cacheable tiles/point series for production scale
```

Every current value is fictional demonstration data. The UI must always show
`DEMO — Зохиомол өгөгдөл, бодит цаг агаарын мэдээ биш`; it must not present demo
conditions as observations, forecasts, scientific validation, or official warnings.

## 7. API sketch (future, not implemented)
```http
GET /api/v1/runs/latest
GET /api/v1/locations?search=...
GET /api/v1/forecast?location_id=...
GET /api/v1/layers
GET /tiles/{run}/{layer}/{valid_time}/{z}/{x}/{y}.webp
```
Use versioned, cacheable responses. Validate all inputs. No personal location collection without consent.

## 8. Performance, reliability, security
- Web Vitals goals: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 (p75); test on low-end Android/slow network.
- Map/chart JS is dynamically imported; avoid layout shifts; provide non-WebGL fallback.
- Cache immutable forecast products and tiles at CDN/object storage; invalidate by run/version.
- Load test realistic traffic; 1,000 concurrent users is a **test scenario**, not a promised capacity.
- Security: TLS, secure headers/CSP, OWASP controls, input validation, rate limits, secrets management, dependency scanning, backup/recovery.
- Accessibility: semantic HTML, keyboard support, focus indicators, sufficient contrast, reduced motion, WCAG 2.2 AA target.
- Monitoring: errors, latency p95/p99, cache hit rate, data freshness, failed processing runs.

### 8.1 Base-map policy and production migration

Phase 1 uses the public OpenStreetMap Standard raster endpoint directly, with visible
OpenStreetMap attribution. This is suitable only for development and modest interactive
demonstration traffic: the service is best-effort, has no SLA, can block abusive use,
and forbids bulk/offline scraping. The application does not prefetch tiles, proxy the
endpoint, or use it for headless bulk rendering.

Before public production load, generate Mongolia-focused vector tiles from OpenStreetMap
data (for example with Planetiler), host them on existing university infrastructure or
an explicitly budgeted provider, and point the isolated base-map configuration at that
source. Attribution and source-version records remain mandatory.

## 9. Cost boundaries
All chosen core frameworks/libraries are free/open source. Running infrastructure can incur electricity, domain, internet, storage, or hosting fees. Prefer localhost and existing university hardware. Free CDN/CI tiers have quotas and changing terms. Do not silently activate paid services.

## 10. Roadmap and acceptance criteria
**P0 — Bootstrap:** scaffold runs, lint/build pass, docs committed.
**P1 — Map-first UI foundation (implemented):** responsive explorer, real MapLibre base map, deterministic synthetic layers, wind particles, time controls, point selection, persistent demo disclosure, and zero-map-JS Lite Mode.
**P2 — Data proof:** inspect real NetCDF; produce validated time series for one grid cell and document units/provenance.
**P3 — API integration:** FastAPI returns processed point forecast; Next.js displays it with loading/error/empty states.
**P4 — Validated explorer:** connect processed forecast products, validate layer semantics, complete audience-specific workflows, and add permitted export/research tools.
**P5 — Hardening:** repeatable load/security/accessibility tests, cache tuning, observability, scientific verification.

## 11. Decision record
- **ADR-001:** Next.js chosen by project owner over earlier SvelteKit proposal.
- **ADR-002:** Zero-cost-first, open-source core stack.
- **ADR-003:** Modular application + separate offline weather worker, not premature microservices.
- **ADR-004:** Scientific transparency and low-end mobile performance are product requirements.
- **ADR-005:** Keep map rendering behind a provider boundary; synthetic and future WRF sources must use the same typed UI contract.
- **ADR-006:** Lite Mode must remain useful without loading MapLibre or requesting third-party tiles.
- **ADR-007:** Public OpenStreetMap Standard tiles are a development/demo base map, not the production scaling strategy.
