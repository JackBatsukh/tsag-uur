# Tsag-uur Lighthouse ба browser performance тайлан

Огноо: 2026-11-20  
Шинжилсэн commit: `406912a` дээрх энэ ажлын working tree  
Хэмжилтийн хаяг: `http://127.0.0.1:3000/`

## Товч дүгнэлт

Development server дээр авсан 85 оноо нь production baseline биш байсан. Түүнд React development runtime, Next.js DevTools, Turbopack HMR болон browser extension script орсон байсан. Энэ ажлаар `npm run build` + `npm run start` production build-ийг extension-гүй түр Chrome profile-оор mobile, desktop тус бүр гурван удаа хэмжсэн.

Median үр дүн:

| Profile | Performance | FCP | LCP | Speed Index | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile baseline | 64 | 1,451 ms | 5,655 ms | 4,966 ms | 2,983 ms | 0.0139 | 873.3 KB |
| Mobile final | **96** | **911 ms** | **2,716 ms** | **1,502 ms** | **57 ms** | **0.0020** | **267.1 KB** |
| Desktop baseline | 68 | 351 ms | 1,358 ms | 1,722 ms | 541 ms | 0.0072 | 1,083.2 KB |
| Desktop final | **92** | 379 ms | **1,193 ms** | **1,236 ms** | **176 ms** | 0.0072 | **920.3 KB** |

Mobile median-д performance +32 оноо, TBT 98.1%, Speed Index 69.8%, нийт transfer 69.4% буурсан. Desktop median-д performance +24 оноо, TBT 67.5%, Speed Index 28.2%, нийт transfer 15.0% буурсан.

## Хэмжилтийн нөхцөл

- Windows 10/11 host, Chrome `158.0.8127.36`, Lighthouse CLI `12.8.2`.
- Next.js `16.4.2`, React `19.3.0`, npm `10.9.2`.
- Ашигласан Node `23.5.0`. Төслийн `engines` нь `>=24 <25`; CI болон deployment дээр Node 24 ашиглах шаардлагатай.
- `npm run build`, дараа нь яг `npm run start` (`NODE_ENV=production`).
- Chrome flags: `--headless=new --disable-extensions --no-first-run --incognito`.
- Run бүр тусдаа цэвэр Lighthouse Chrome session; extension script байгаагүй.
- Mobile: 412 × 823, DPR 1.75, simulated 150 ms RTT / 1,638.4 Kbps, 4× CPU slowdown, Moto G Power emulation.
- Desktop: 1,350 × 940, DPR 1, simulated 40 ms RTT / 10,240 Kbps, CPU slowdown 1×.
- Baseline ба final-ийг нэг машин, нэг production workflow, ижил Lighthouse хувилбар ба flags-аар хэмжсэн.
- Mobile, desktop тус бүр гурван run; хүснэгтийн гол харьцуулалт нь component-wise median.
- Final raw JSON тайлангууд `.next/performance/final/` дотор үүссэн. `.next` нь git-д орохгүй, дараагийн build дээр цэвэрлэгдэж болно.

Final Lighthouse ажиллуулах хэлбэр:

```powershell
npx --yes lighthouse@12.8.2 http://127.0.0.1:3000 --quiet --only-categories=performance --output=json --chrome-flags="--headless=new --disable-extensions --no-first-run --incognito"
npx --yes lighthouse@12.8.2 http://127.0.0.1:3000 --quiet --preset=desktop --only-categories=performance --output=json --chrome-flags="--headless=new --disable-extensions --no-first-run --incognito"
```

## Baseline: production, өөрчлөлтийн өмнө

### Mobile гурван run

| Run | Score | FCP | LCP | SI | TBT | CLS | Transfer | Main thread | Bootup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 66 | 1,476 ms | 5,655 ms | 3,042 ms | 478 ms | 0.0139 | 876.9 KB | 3,078 ms | 1,582 ms |
| 2 | 43 | 1,451 ms | 6,847 ms | 5,067 ms | 2,983 ms | 0.0119 | 873.3 KB | 7,793 ms | 6,582 ms |
| 3 | 64 | 1,115 ms | 2,472 ms | 4,966 ms | 3,810 ms | 0.0139 | 566.8 KB | 6,873 ms | 2,057 ms |
| Median | **64** | **1,451 ms** | **5,655 ms** | **4,966 ms** | **2,983 ms** | **0.0139** | **873.3 KB** | **6,873 ms** | **2,057 ms** |

Run хоорондын өндөр хэлбэлзэл нь MapLibre cold parse, live grid state update болон OSM tile network-ийг initial mobile load дээр зэрэг эхлүүлж байсантай холбоотой. Run 3-ын бага transfer нь бүх external tile ижил хэмжээгээр ирээгүйг харуулсан; зөвхөн тэр run-ийг сонгож дүгнээгүй.

### Desktop гурван run

| Run | Score | FCP | LCP | SI | TBT | CLS | Transfer | Main thread | Bootup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 67 | 262 ms | 1,660 ms | 1,279 ms | 735 ms | 0.0072 | 961.8 KB | 2,106 ms | 1,370 ms |
| 2 | 80 | 377 ms | 1,358 ms | 1,722 ms | 318 ms | 0.0053 | 1,103.8 KB | 1,671 ms | 1,257 ms |
| 3 | 68 | 351 ms | 1,076 ms | 3,231 ms | 541 ms | 0.0072 | 1,083.2 KB | 2,054 ms | 738 ms |
| Median | **68** | **351 ms** | **1,358 ms** | **1,722 ms** | **541 ms** | **0.0072** | **1,083.2 KB** | **2,054 ms** | **1,257 ms** |

## Илэрсэн bottleneck

### Development ба production JavaScript

Анхны localhost audit дахь React development runtime, Next.js DevTools, Turbopack HMR болон extension script нь production bundle-ийн хэсэг биш. Production audit-д:

- `unminified-javascript` ба `unminified-css` audit хоёулаа 1.0 score;
- Next DevTools, React development runtime, HMR client, extension script байхгүй;
- custom minifier нэмээгүй; Next.js production compiler-ийн minification/code splitting-ийг ашигласан;
- third-party main-thread CPU 0 ms; external request нь OSM raster tile байсан.

### Font ба Кирилл

Апп Geist font ашигладаггүй. CSS нь `Inter`, `ui-sans-serif`, `system-ui`, `Segoe UI`, `Noto Sans Cyrillic` зэрэг system fallback stack ашиглаж байна. Production audit бүрт:

- font request: 0;
- `font-display` issue: 0;
- `.woff/.woff2` production request: 0.

Иймээс өмнөх critical request path дээрх Geist Latin нь Next development tooling-ийн request байсан. Custom webfont нэмж transfer болон Cyrillic fallback эрсдэл үүсгээгүй.

### MapLibre ба initial JavaScript

- MapLibre нь аль хэдийн dynamic import байсан боловч анхны mobile session full map-аар эхэлдэг тул 288.2 KB transfer / ойролцоогоор 1,059.6 KB decoded chunk initial interaction path-д орж байсан.
- Baseline full-map lifecycle script transfer 448.9 KB, total transfer 734.3 KB байсан.
- MapLibre chunk-ийн mobile audit дахь unused хэсэг ойролцоогоор 193.6 KB байсан. Энэ нь generic map library-ийн тухайн route дээр ашиглаагүй API; map feature-ийг хасах үндэслэл биш.
- React/Next common runtime production transfer ойролцоогоор 71.3 KB; final mobile unused JS audit-д зөвхөн энэ chunk-ийн 25.6 KB үлдсэн.

### Live weather grid

- `/api/weather-grid` JSON нь 229,977 byte байсан ч Next server response дээр `Content-Encoding` байгаагүй.
- Lighthouse baseline transfer нь 225.4 KB орчим.
- Client fetch `cache: "no-store"` ашиглаж байсан тул browser-ийн `max-age` cache-ийг зориудаар алгасаж байв.
- Live provider ирэхэд Weather Explorer дахин render хийдэг. Final mobile LCP candidate нь live өгөгдөл ирсний дараа шинэчлэгдсэн `lite-map__freshness` текст; LCP-ийн 83% нь render delay байна.

### CSS

Final mobile дээр render-blocking гэж бүртгэгдсэн хоёр stylesheet 8.4 KB ба 5.7 KB transfer, нийлбэр estimated saving 456 ms. Гэхдээ:

- эдгээр нь initial shell, layout, accessibility, mobile Lite Mode-ийн харагдах style;
- unused CSS audit 1.0 буюу хэмжигдсэн wasted bytes байхгүй;
- тэдгээрийг async болговол FOUC/CLS үүсэх эрсдэлтэй.

Тиймээс essential CSS-ийг зориудаар хадгалсан. Production CSS аль хэдийн minified, route-аар code-split хийгдсэн.

## Хийсэн өөрчлөлт

1. Анхны compact viewport болон `Save-Data` хэрэглэгчийг Lite Mode-оор эхлүүлдэг болгосон. Хэрэглэгчийн хадгалсан сонголт үргэлж давуу.
2. SSR/hydration snapshot-ийг lightweight төлөв болгож, first-visit mobile дээр MapLibre chunk speculative download хийхээс сэргийлсэн.
3. Client weather fetch-ийн `no-store`-ийг авч, API-ийн `max-age=300`, `stale-while-revalidate` browser cache-ийг ажилладаг болгосон.
4. `/api/weather-grid` response-д request-ийн `Accept-Encoding`-ийг хүндэтгэх native gzip нэмсэн. Raw 229,977 byte JSON нь 64,396 byte болж 72.0% буурсан. `Vary: Accept-Encoding` болон `Content-Length` зөв тавигдана.
5. Live GFS provider-ийн non-interactive state update-ийг React transition болгож, urgent hydration/update task-аас салгасан. Үүний дараах final desktop TBT гурван run-д 172–212 ms болж тогтворжсон.
6. Map ready төлөв, weather overlay-ийг эхэлж гаргаад wind particle renderer-ийг idle callback (fallback 200 ms timer)-аар хойшлуулсан. Cleanup нь idle callback/timer-ийг cancel хийнэ.
7. Redundant WebGL probe canvas-ийг авч, MapLibre constructor-ийн өөрийн GPU initialization/error handling-ийг ашигласан; GPU unavailable fallback message хадгалагдсан.
8. CDP lifecycle script-д GC дараах DOM, heap, listener, detached DOM, MapLibre/canvas, frame timing, repeated route/mode/layer/zoom profiling нэмсэн. `npm run perf:profile` командаар давтагдана.
9. Custom JavaScript minification, шинэ runtime dependency, paid tooling нэмээгүй.

## Final Lighthouse

### Mobile гурван run

| Run | Score | FCP | LCP | SI | TBT | CLS | Transfer | Main thread | Bootup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 96 | 911 ms | 2,717 ms | 1,504 ms | 57 ms | 0.0020 | 267.1 KB | 982 ms | 303 ms |
| 2 | 96 | 911 ms | 2,716 ms | 1,502 ms | 47 ms | 0.0020 | 267.1 KB | 1,001 ms | 293 ms |
| 3 | 96 | 910 ms | 2,714 ms | 1,472 ms | 59 ms | 0.0020 | 267.1 KB | 849 ms | 273 ms |
| Median | **96** | **911 ms** | **2,716 ms** | **1,502 ms** | **57 ms** | **0.0020** | **267.1 KB** | **982 ms** | **293 ms** |

Mobile final run бүр MapLibre, OSM tile request 0 байсан. Weather API 63.8 KB transfer, нийт script 154.6 KB орчим болсон.

### Desktop гурван run

| Run | Score | FCP | LCP | SI | TBT | CLS | Transfer | Main thread | Bootup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 92 | 388 ms | 1,211 ms | 1,261 ms | 172 ms | 0.0073 | 920.3 KB | 1,267 ms | 890 ms |
| 2 | 90 | 374 ms | 1,193 ms | 1,203 ms | 212 ms | 0.0072 | 920.3 KB | 1,280 ms | 955 ms |
| 3 | 92 | 379 ms | 1,178 ms | 1,236 ms | 176 ms | 0.0072 | 938.2 KB | 1,293 ms | 922 ms |
| Median | **92** | **379 ms** | **1,193 ms** | **1,236 ms** | **176 ms** | **0.0072** | **920.3 KB** | **1,280 ms** | **922 ms** |

Desktop нь full map-аа хадгалсан. Transfer-ийн run хоорондын 17.9 KB зөрүү нь external OSM tile response/cache timing-ийн хэлбэлзэл.

### Median өөрчлөлт

| Metric | Mobile | Desktop |
| --- | ---: | ---: |
| Performance score | 64 → 96 (+32) | 68 → 92 (+24) |
| FCP | 1,451 → 911 ms (-37.2%) | 351 → 379 ms (+8.0%) |
| LCP | 5,655 → 2,716 ms (-52.0%) | 1,358 → 1,193 ms (-12.2%) |
| Speed Index | 4,966 → 1,502 ms (-69.8%) | 1,722 → 1,236 ms (-28.2%) |
| TBT | 2,983 → 57 ms (-98.1%) | 541 → 176 ms (-67.5%) |
| CLS | 0.0139 → 0.0020 (-85.6%) | 0.0072 → 0.0072 |
| Transfer | 873.3 → 267.1 KB (-69.4%) | 1,083.2 → 920.3 KB (-15.0%) |
| Main-thread work | 6,873 → 982 ms (-85.7%) | 2,054 → 1,280 ms (-37.7%) |
| JS bootup | 2,057 → 293 ms (-85.8%) | 1,257 → 922 ms (-26.7%) |

Final гурван mobile audit-д forced reflow insight passed; хэмжигдсэн reflow item байгаагүй. Development audit-ийн ойролцоогоор 33 ms reflow-ийг production regression гэж үзээгүй.

## Route bundle хэмжээ

Доорх нь production build manifest-аас тооцсон minified, compression-оос өмнөх initial route JS. Dynamic MapLibre chunk тусдаа.

| Route | Initial JS | JS file count |
| --- | ---: | ---: |
| `/` | 509.7 KB | 8 |
| `/dashboard` | 465.3 KB | 7 |
| `/herder` | 477.7 KB | 7 |
| `/farmer` | 543.2 KB | 9 |
| `/offline` | 465.3 KB | 7 |

MapLibre production chunk: 1,059.6 KB minified decoded, ойролцоогоор 288.2 KB network transfer. Энэ chunk mobile Lite Mode дээр татагдахгүй; desktop full map болон хэрэглэгчийн explicit full-map сонголтоор л татагдана. Farmer route газрын зураг харагдах хэсэгт ойртох хүртэл dynamic map-аа defer хийсээр байна.

## Lifecycle, animation, memory ба DOM profiling

CDP check нь 390 × 844 viewport, 4× CPU, 150 ms latency/1.6 Mbps орчим network нөхцөлөөр ажилласан.

| Mode | LCP | CLS | Long tasks | Long-task time | Transfer | Script | Heap | CDP nodes | Map requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full mobile map | 1,700 ms | 0.053 | 5 | 759 ms | 555.5 KB | 449.0 KB | 6.35 MB | 768 | 9 |
| Lite mobile | 1,716 ms | 0.041 | 2 | 248 ms | 250.4 KB | 154.6 KB | 3.02 MB | 752 | 0 |

Full map animation 90 frame sample дээр 59.9 FPS, p95 17.1 ms, max 17.1 ms байсан. Canvas нь map stage-аа дүүргэсэн, weather overlay болон wind particle animation ажилласан, browser exception/failed request 0.

Repeated interaction profile:

- weather layer бүрийг сольсон;
- zoom in/out гурван удаа;
- Lite/full map гурван cycle;
- Citizen → Herder → Citizen → Farmer → Citizen navigation дөрвөн cycle;
- Farmer map section рүү scroll хийж lazy MapLibre canvas ready болсныг шалгасан;
- Herder дотор view switch хийсэн;
- Researcher mode нь хэрэглэгчид харагдах disabled/`Дараа` төлөвөөрөө үлдсэн.

GC дараах 4-cycle snapshot:

| Snapshot | JS heap | Documents | DOM nodes | JS listeners | Connected elements | Map hosts/canvases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Settled | 6.75 MB | 5 | 777 | 382 | 329 | 1 / 1 |
| Cycle 1 | 8.77 MB | 12 | 3,535 | 469 | 1,231 | 1 / 1 |
| Cycle 2 | 9.15 MB | 12 | 3,536 | 471 | 1,231 | 1 / 1 |
| Cycle 3 | 8.85 MB | 12 | 3,546 | 473 | 1,231 | 1 / 1 |
| Cycle 4 | 8.89 MB | 12 | 3,547 | 473 | 1,231 | 1 / 1 |
| Final | 9.28 MB | 12 | 3,533 | 470 | 1,228 | 1 / 1 |

Эхний navigation-аар Next router route cache-аа дүүргэсний дараа document, node, listener, MapLibre instance, connected canvas count тогтворжсон. Heap GC-ийн дараа 8.3–9.2 MB мужид хэлбэлзсэн; cycle тутам шугаман өсөөгүй. Иймээс application-level leak нотлогдоогүй.

Headless Chrome-ийн `DOM.getDetachedDomNodes` нь map load бүрт class-гүй 166 × 134 canvas root нэгээр нэмэгдүүлсэн. Connected MapLibre canvas үргэлж 1; Farmer route анхны удаа cache-д орсны дараа connected canvas нийт 5 болоод цааш өсөөгүй. Listener/node/heap мөн plateau хэвээр байсан. Shape нь MapLibre/Chromium raster image decode fallback-тэй таарч байгаа боловч retained path-ийг энэ CDP command дангаараа батлахгүй. Тиймээс үүнийг батлагдсан app leak гэж нэрлээгүй; real GPU Chrome profile дээр heap snapshot retained path-аар дахин шалгах remaining item болгосон.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed (`next typegen && tsc --noEmit`).
- `npm test`: 27/27 passed.
- `npm run build`: passed; 12/12 static page generation completed.
- `npm run start`: production server ready.
- Mobile Lighthouse: 3/3 completed.
- Desktop Lighthouse: 3/3 completed.
- Full-map lifecycle: passed.
- Lite lifecycle: passed; MapLibre/OSM request 0.
- Repeated interaction/memory profile: passed.
- Citizen, Herder, Farmer, Researcher state validation: passed.
- Farmer lazy map: passed.
- Mobile full map, weather overlay, wind animation: passed.
- Browser exception, console error, failed request: 0 in final mode-validation run.

## Үлдсэн bottleneck ба дараагийн ажил

1. Mobile median LCP 2,716 ms буюу 2.5 s зорилтоос 216 ms өндөр. LCP нь GFS response ирсний дараа шинэчлэгдсэн freshness text. Дараагийн бодит сайжруулалт нь initial point summary-г жижиг endpoint/server data болгох эсвэл full grid-ийг interaction-ийн дараа татах; текстийг нууж score өсгөхийг зөвлөхгүй.
2. Essential CSS mobile simulated network дээр 456 ms render-blocking estimate хэвээр. Unused CSS 0 тул route shell/style architecture-ийг өөрчлөхөөс өмнө real-user data шаардлагатай.
3. Desktop full map дээр MapLibre 288.2 KB transfer, generic library unused JS audit ойролцоогоор 216 KB хэвээр. Feature хадгалсан тул үүнийг remove хийгээгүй.
4. Root Weather Explorer нь өргөн client boundary хэвээр. Жижиг server/client island болгон хуваах боломжтой ч provider, timeline, selected point, sidebar state хоорондын coupling-ийг refactor/test хийх хэрэгтэй.
5. OSM public raster tile latency ба cache нь desktop transfer/Speed Index хэлбэлзэлд нөлөөлнө. Production traffic-д tile usage policy, CDN/proxy/cache strategy-г тусдаа шийдэх шаардлагатай.
6. Headless profile-ийн class-гүй detached raster canvas retained path-ийг Chrome DevTools heap snapshot-аар баталгаажуулах.
7. Next.js `16.4.2` build нь мэдэгдэж буй security vulnerability анхааруулга гаргасан. Performance өөрчлөлттэй хольж dependency upgrade хийгээгүй; security upgrade-ийг тусдаа worktree/PR-д хийх шаардлагатай.
8. Local validation Node `23.5.0` дээр болсон ч repository Node 24 шаарддаг. CI-г Node 24 дээр дахин ажиллуулах.

## Дүгнэлт

Mobile Lite Mode нь feature хассан хувилбар биш: текстэн цаг агаар, live GFS grid, layer/timeline/mode UI ажиллана, хэрэглэгч хүсвэл full interactive map-аа шууд нээнэ. Desktop full map, Farmer lazy map, MapLibre overlay, wind animation, accessibility, бүх mode хэвээр. Хэмжигдсэн үндсэн ахиц нь mobile first-load-аас heavy map engine-ийг салгах, live grid-ийг wire дээр шахах, cache-ийг сэргээх, wind initialization-ийг critical task-аас салгаснаас гарсан.
