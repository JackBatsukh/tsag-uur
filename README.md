# Tsag-uur

Монгол орны цаг агаарын загварын өгөгдлийг ойлгомжтой, ил тод байдлаар хүргэх weather intelligence платформын frontend суурь.

## Одоогийн төлөв

Phase 1-ийн map-first weather explorer хэрэгжсэн:

- Монголын MapLibre зураг болон OpenStreetMap суурь зураг;
- температур, салхи, хур тунадас, чийгшил, даралтын ажиллагаатай Canvas давхаргууд;
- U/V бүрэлдэхүүн дагасан салхины бөөмс;
- цэг сонголт, хотын локал хайлт, 24 цагийн timeline;
- бага дата зарцуулах Lite Mode;
- responsive мэдээллийн самбар `/dashboard` замд.
- `/herder` замд зургаан үндсэн үйлдэлтэй, гар утсанд түрүүлж зохиосон **Малчин горим 2.0**: SOS, сураггүй хүн ба алга болсон малын дотоод төлөвлөгөө, NASA FIRMS дулааны цэг, бодит урьдчилсан төлөв, урт замын хоёр цэгийн цаг агаар, олон нийтийн ноорог/залруулга.

> **DEMO — Зохиомол өгөгдөл, бодит цаг агаарын мэдээ биш.** Одоогийн бүх утга deterministic UI жишээ бөгөөд бодит ажиглалт, урьдчилсан мэдээ, шинжлэх ухааны баталгаа эсвэл албан ёсны сэрэмжлүүлэг биш.

## Шаардлага

- Node.js 24
- npm
- WebGL2 дэмждэг browser (бүрэн зурагт горимд)

## Локал хөгжүүлэлт

```bash
npm install
npm run dev
```

Дараа нь [http://localhost:3000](http://localhost:3000)-ийг нээнэ. Анхны гар утасны нээлт болон data-saver холболт Lite Mode-оор эхэлнэ; хэрэглэгч интерактив зургийг товчоор ачаалж болно. Desktop дээр интерактив зураг анхдагчаар нээгдэнэ.

## Чухал замууд

- `/` — интерактив map-first explorer
- `/dashboard` — мэдээллийн dashboard reference
- `/herder` — Малчин горим 2.0: тусламж, хайлт, гал, цаг агаар, замын эрсдэл

Малчин горимын ноорог, итгэлтэй хүмүүс болон эмзэг хайлтын мэдээлэл зөвхөн browser-ийн `localStorage`-д хадгалагдана. SOS болон хөршийн мэдэгдлийг автоматаар илгээхгүй: хэрэглэгч мессежээ урьдчилан харж, copy/native share/`sms:`/`tel:` үйлдлийг өөрөө батална. Хүргэлтийн provider байхгүй үед “sent” эсвэл “delivered” төлөв харуулахгүй.

Цаг агаарын хүсэлт Next.js route-оор Open-Meteo-ийн Best Match forecast руу дамжина. Алга болсон малын урсгал сүүлд харсан цэгээс хойших 168 хүртэл цагийн архивлагдсан загварын салхи, цас, бороог нэгтгэн тайлбар бүхий хайлтын сектор гаргадаг. Энэ нь GPS мөр эсвэл байршлын магадлалын хувь биш. NASA FIRMS адаптер `NASA_FIRMS_MAP_KEY` байхгүй үед хиймэл дулааны цэг үүсгэхгүй, “тохируулаагүй” төлөв буцаана. Verify.mn нь mobile-originated баталгаажуулалт гэдгийг тусад нь баримтжуулсан бөгөөд outbound SMS гэж ашиглаагүй.

Тохиргоог [`.env.example`](./.env.example), хэрэгжүүлэлтийн бүрэн тайланг [`HERDER_MODE_2_REPORT.md`](./HERDER_MODE_2_REPORT.md), хэмжилтийг [`PERFORMANCE_REPORT.md`](./PERFORMANCE_REPORT.md)-ээс харна уу.

## Шалгалтууд

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run perf:lifecycle
npm run perf:lighthouse
```

Performance шалгалтууд нь эхлээд production build шаарддаг. Herder Mode-ийг тусад нь шалгахдаа PowerShell дээр `$env:TSAG_UUR_PERF_PATH='/herder'` тохируулна. `perf:lifecycle` нь throttled mobile горим, service worker, browser exception, tile request, DOM ба heap-ийг шалгана. `perf:lighthouse` нь тайлангаа `.next/performance/` дотор үүсгэж, LCP/CLS/TBT болон Lighthouse ангиллын budget-ийг мөрдүүлнэ.

## Өгөгдөл ба зураглал

`src/features/weather-data` дахь typed provider нь одоогоор тогтвортой, зохиомол торон өгөгдөл үүсгэнэ. Ирээдүйн боловсруулсан WRF өгөгдлийн source мөн энэ contract-ыг хэрэгжүүлнэ; бүрэн NetCDF файлыг browser эсвэл энгийн web request дотор боловсруулахгүй.

MapLibre зөвхөн бүрэн зурагт горим шаардсан үед dynamic import-оор ачаалагдана. Lite Mode нь MapLibre JavaScript болон гуравдагч талын tile request огт үүсгэхгүй.

Хөгжүүлэлтийн суурь зураг нь attribution бүхий OpenStreetMap Standard raster endpoint ашиглана. Энэ endpoint нь SLA-гүй, best-effort demo үйлчилгээ тул bulk/offline таталт, proxy, headless tile scraping хийхгүй. Олон хэрэглэгчтэй production орчинд Монголын OSM vector tile-ийг Planetiler/PMTiles зэрэг нээлттэй хэрэгслээр урьдчилан үүсгэж, их сургуулийн дэд бүтцэд өөрсдөө host хийхээр төлөвлөсөн.

Дэлгэрэнгүй шийдвэр, өгөгдлийн хязгаарлалт, дараагийн үе шатыг `PROJECT_ARCHITECTURE.md`, хөгжүүлэлтийн дүрмийг `AGENTS.md`-ээс харна уу.
