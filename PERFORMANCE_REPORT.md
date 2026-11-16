# Tsag-uur — Herder Mode 2.0 performance report

**Хэмжсэн огноо:** 2026-11-16  
**Зам:** `/herder`  
**Build:** Next.js 16.4.2 production, Turbopack  
**Орчин:** Chromium headless, 390 × 844 CSS px, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download / 0.75 Mbps upload.

Энэ тайланд зөвхөн бодитоор ажиллуулсан хэмжилтийг оруулсан. Visible browser host энэ session-д нээгдээгүй тул гар ажиллагаатай screenshot QA хийгдээгүй; доорх browser үзүүлэлтүүд repository-ийн CDP/Lighthouse скриптээс гарсан.

## JavaScript bundle

- Өмнөх Herder initial JS: **512,043 bytes**.
- Эцсийн Herder initial JS: **490,027 bytes**.
- Өөрчлөлт: **−22,016 bytes (−4.3%)**.
- Эцсийн бүх route/chunk нийлбэр: **1,953,475 raw bytes**, **567,686 gzip bytes**, 30 chunk.
- Өмнөх бүх build: **1,905,034 raw bytes**, **550,742 gzip bytes**, 26 chunk.
- Нийт build өссөн шалтгаан: шинэ safety workflow-ууд тусдаа lazy chunk болсон ба бусад map-route өөрчлөлтүүд build-д орсон. Анхны Herder ачаалал багассан нь хэрэглэгчийн бодит замд хамаарах гол үзүүлэлт.
- MapLibre-ийн ойролцоогоор **1,085,017-byte raw** chunk Herder home дээр ачаалагдахгүй; зөвхөн мал хайх үр дүнгээс газрын зураг нээхэд татагдана.

## Throttled mobile lifecycle

`TSAG_UUR_PERF_PATH=/herder npm run perf:lifecycle` эцсийн үр дүн:

- LCP: **1,228 ms**.
- CLS: **0**.
- DOM nodes: **455**.
- JS heap used: **2.55 MB**.
- Script duration: **319 ms**.
- Нийт resource: **12**; transfer **178,080 bytes**; script transfer **147,899 bytes**.
- MapLibre/OSM request: **0**.
- Service Worker ready: **тийм**.
- Browser exception, browser console error, failed request: **0**.

Root weather explorer-ийн `Link` prefetch-ийг унтрааснаар idle Herder home-ийн хүсэлт 17-оос 12 болж, хүсээгүй RSC/route chunk таталт арилсан.

## Lighthouse

`TSAG_UUR_PERF_PATH=/herder npm run perf:lighthouse` эцсийн үр дүн:

- Performance: **98%**.
- Accessibility: **100%**.
- Best Practices: **100%**.
- SEO: **100%**.
- LCP: **2,287 ms**.
- CLS: **0**.
- Total Blocking Time: **65 ms**.

Тайлангууд `.next/performance/lighthouse.report.html` болон `.next/performance/lighthouse.report.json` дотор үүссэн. `.next` нь build artifact тул Git-д commit хийхгүй.

## Хийгдээгүй / хязгаар

- INP-ийг лабораторийн navigation run-аар найдвартай хэмжихгүй; production RUM шаардлагатай.
- Олон удаагийн device matrix, Android WebView, battery/thermal throttling хийгдээгүй.
- Visible browser host unavailable байсан тул touch interaction болон screenshot-based visual regression хийгдээгүй.
- Full map нээсний дараах MapLibre heap/canvas хэмжилтийг тусдаа production scenario болгон үргэлжлүүлэх шаардлагатай.
