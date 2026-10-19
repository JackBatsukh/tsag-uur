# AGENTS.md — Tsag-uur Coding Agent Instructions

## Project status
This repository is a newly scaffolded Next.js project. Assume NO application features, API, database, weather pipeline, authentication, or deployment have been implemented. Inspect actual files before making assumptions.

## Mission
Build **Tsag-uur**, a Mongolia-focused weather intelligence and decision-support web app for citizens, herders, and researchers. Initial weather input is university-provided WRF/NetCDF data. Prioritize scientific correctness, low-end mobile usability, performance, security, accessibility, and zero-cost development.

## Approved baseline
- Next.js App Router, React, TypeScript, Tailwind CSS (only if already installed).
- Server Components by default; add `use client` only to interactive islands.
- Native semantic HTML and CSS first. Avoid gratuitous animation, heavy UI libraries, and unnecessary JS.
- Future, not yet installed: FastAPI/Python/xarray weather processor; PostgreSQL/PostGIS; Valkey; MapLibre; object storage.
- Prefer free/open-source software and existing hardware; ask before introducing any paid services, billing, cloud accounts, or dependencies.

## Mandatory workflow
1. Inspect `package.json`, `src/app` or `app`, config files, and existing scripts.
2. State a short plan and list files to change before substantial work.
3. Implement one small, testable increment at a time; do not scaffold the whole platform prematurely.
4. Preserve existing functionality. Avoid unrelated refactors.
5. Run available lint, type-check, build, and relevant tests; report exact results and any commands not run.
6. Summarize changes, rationale, and next step.
7. Ask for confirmation before destructive commands, deployment, database migrations, or large dependency additions.

## Product principles
- Clearly distinguish forecast, observation, model simulation, and demonstration data.
- Never present historical WRF data as a live forecast. Always show valid time, run time, units, model/source, and spatial resolution where applicable.
- Do not claim hyperlocal accuracy beyond source grid resolution.
- Do not fabricate warning thresholds, model skill, forecast confidence, or safety advice. Risk features require documented rules and validation.
- Build three future views: Citizen, Herder, Researcher. Start with a shared forecast foundation.
- Support Mongolian language, mobile-first layouts, low-bandwidth/Lite Mode, and accessibility.

## Frontend engineering
- Default to SSR/static output and cached responses where appropriate.
- Keep the main page useful without loading a map or chart bundle.
- Lazy-load heavy visualization; provide accessible text/table fallback.
- Prefer CSS Grid/Flexbox, native controls, reduced motion, and stable layouts.
- Optimize for LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at p75 in real-user measurement; these are targets, not guarantees.
- Avoid premature global state libraries and large component libraries.
- Use typed interfaces, error/empty/loading states, keyboard navigation, visible focus, and meaningful labels.

## Backend/data engineering (future)
- Never read or parse full NetCDF files per HTTP request.
- Build an offline ingestion/validation/precomputation pipeline.
- Publish versioned forecast products; use cached point forecasts and map tiles.
- Convert units explicitly (e.g., T2 Kelvin to Celsius); derive wind speed from U10/V10; distinguish cumulative precipitation from interval totals.
- Validate time coordinates, CRS, missing values, dimensions, and model provenance.
- Use API input validation, least privilege, rate limiting, structured logs, and secrets in environment variables.
- No secrets in Git. Never commit raw large weather files without explicit approval.

## Suggested evolution
Phase 0: baseline audit and project docs.
Phase 1: accessible responsive shell with mock data clearly labeled.
Phase 2: inspect sample NetCDF and create offline weather processing proof of concept.
Phase 3: FastAPI point forecast API and Next.js integration.
Phase 4: map layers, time slider, Lite Mode, user modes.
Phase 5: security/performance/load testing and scientific verification.

## Project reference
Read `PROJECT_ARCHITECTURE.md` before implementing architecture or adding major dependencies. If a design decision changes, update the document and explain why.
