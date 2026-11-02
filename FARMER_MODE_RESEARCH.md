# Farmer Mode research and scientific boundaries

**Status:** implementation research record, reviewed 2026-10-31.
**Product status:** deterministic demonstration only. No operational agronomic recommendation, official warning, or real forecast is produced.

## Primary sources used

1. **FAO Irrigation and Drainage Paper 56 — Crop evapotranspiration**  
   https://www.fao.org/4/X0490E/X0490E00.htm  
   FAO-56 defines the reference evapotranspiration and crop-coefficient framework. Operational crop-water demand needs complete, quality-controlled meteorological inputs, crop coefficients, growth stage, rooting information, soil water state, and water-balance assumptions. Farmer Mode therefore exposes a future FAO-56-compatible boundary but does **not** calculate ET₀, ETc, soil depletion, irrigation depth, or irrigation volume.

2. **FAO Frost protection: fundamentals, practice, and economics**  
   https://www.fao.org/4/y7223e/y7223e0b.htm  
   Plant temperature can differ materially from measured air temperature depending on radiation, exposure, ground, leaf, and ventilation conditions. The UI always describes low 2 m air temperature as a potential-condition screen, never a guaranteed frost event. No protection start/stop temperature is recommended without wet-bulb/dew-point and in-crop observations.

3. **WMO Guide to Agricultural Meteorological Practices (WMO-No. 134)**  
   https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/agricultural-meteorology/guide-agricultural-meteorological-practices-gamp2010-edition-wmo-no134  
   Used as the general measurement and agrometeorological-practice reference. The current demo does not claim station-grade measurements.

4. **FAO/GIEWS Mongolia country brief and crop calendar**  
   https://www.fao.org/giews/countrybrief/country/MNG/pdf_archive/MNG_Archive.pdf  
   The country brief documents Mongolia's wheat/barley sowing, growing, and harvest season context and a recent wheat harvest around September. Demo scenario dates are season-aware examples, not a crop calendar recommendation for a specific field.

5. **FAO Mongolia — Mongolia at a glance**  
   https://www.fao.org/mongolia/our-office/mongolia-at-a-glance/en  
   Used for the high-level constraint that harsh climate and short growing seasons limit crop production.

6. **Mongolian Food, Agriculture and Light Industry Ministry — 2026 crop agronomic guidance**  
   https://mofa.gov.mn/files/pdf-files/jm28idfwjo7/69e726d2299cc549f5ef4f67.pdf  
   Used for Mongolia-specific context, including regional precipitation variability and the importance of irrigation for potato production when growing-season precipitation is insufficient. Farmer Mode does not convert this national guidance into field-level water volumes.

7. **Ulaanbaatar hydrometeorological service — agricultural meteorology**  
   https://ulaanbaatar.namem.gov.mn/khuduu/  
   The official service describes separate observations of air/soil temperature, humidity, precipitation, soil moisture, and crop/pasture development. This supports the product rule that rainfall cannot be used to invent soil moisture and that crop phenology must be a distinct input.

## Demonstration decision rules

`src/features/farmer-mode/advisory-engine.ts` contains transparent `DEMO_SCREENING_RULES`. They are comparison screens for the five synthetic scenarios, not official warnings and not validated agronomic thresholds:

- low minimum 2 m air temperature is surfaced as a **possible frost condition** with the FAO plant-versus-air-temperature limitation;
- daily interval precipitation is summed once; cumulative-since-run WRF precipitation must be differenced upstream in a future provider;
- rain/wind/temperature/humidity screens rank relative fieldwork and harvest-weather windows;
- crop maturity remains a user observation and is never inferred from weather;
- soil moisture remains unavailable unless the user enters a measurement;
- precipitation probability remains unavailable because deterministic demo values are not statistically calibrated probabilities.

The crop configurations contain distinct wording and data requirements for wheat, potato, carrot, cabbage, onion, and greenhouse vegetables. They intentionally avoid unvalidated numeric crop thresholds.

## FAO-56-compatible future boundary

An operational irrigation module should receive a validated, versioned record containing at least:

- quality-controlled radiation, air temperature, humidity, and wind observations/forecast at documented heights;
- calculated reference ET₀ with method/version and input-quality flags;
- crop type, locally validated Kc curve, planting/emergence date, and growth stage;
- soil texture, root-zone depth, field capacity, wilting point, depletion fraction, and current root-zone water state;
- irrigation method/efficiency and measured rainfall/irrigation records;
- daily water-balance state and uncertainty.

Only then should the system calculate crop evapotranspiration, depletion, timing, or irrigation depth. The current `AdvisoryResult` contract already separates supporting measurements, missing inputs, validity, provenance, uncertainty, and demo status so the real engine can replace the synthetic rules without rewriting the UI.

## Privacy and operational limits

- Farm coordinates, field configuration, and notes remain in browser `localStorage` only.
- No cadastral boundaries or known farmland locations are supplied.
- The MapLibre marker is a selected point, not a verified field boundary.
- Public OpenStreetMap raster tiles remain demo/development infrastructure under the repository's existing base-map policy.
- Official alerts, crop maturity, soil sensors, field trafficability, pest/disease models, and real WRF/NetCDF data are not connected.
