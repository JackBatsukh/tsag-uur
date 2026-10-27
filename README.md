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
- `/herder` замд алга болсон малын тайлан, өнгөрсөн/ирэх 7 хоногийн тусдаа DEMO мэдээлэл, U/V салхины шинжилгээ, засварлах боломжтой хайлтын бүс, эрсдэлийн текстэн самбар бүхий **Малчин горим**.

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

Дараа нь [http://localhost:3000](http://localhost:3000)-ийг нээнэ. WebGL2 эсвэл тогтвортой сүлжээ байхгүй үед UI-н **Lite** товчоор зураглалгүй fallback горим ашиглаж болно.

## Чухал замууд

- `/` — интерактив map-first explorer
- `/dashboard` — мэдээллийн dashboard reference
- `/herder` — Малчин горимын интерактив DEMO туслах

Малчин горимын хувийн тайлан зөвхөн browser-ийн `localStorage`-д хэрэглэгчийн товч дарснаар хадгалагдана. Сервер, account, analytics, нийтэд хуваалцах механизм нэмээгүй. Судалгаа, нотолгоо ба баталгаажаагүй таамаглалыг [HERDER_MODE_RESEARCH.md](./HERDER_MODE_RESEARCH.md)-д тусад нь баримтжуулсан.

## Шалгалтууд

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Өгөгдөл ба зураглал

`src/features/weather-data` дахь typed provider нь одоогоор тогтвортой, зохиомол торон өгөгдөл үүсгэнэ. Ирээдүйн боловсруулсан WRF өгөгдлийн source мөн энэ contract-ыг хэрэгжүүлнэ; бүрэн NetCDF файлыг browser эсвэл энгийн web request дотор боловсруулахгүй.

MapLibre зөвхөн бүрэн зурагт горим шаардсан үед dynamic import-оор ачаалагдана. Lite Mode нь MapLibre JavaScript болон гуравдагч талын tile request огт үүсгэхгүй.

Хөгжүүлэлтийн суурь зураг нь attribution бүхий OpenStreetMap Standard raster endpoint ашиглана. Энэ endpoint нь SLA-гүй, best-effort demo үйлчилгээ тул bulk/offline таталт, proxy, headless tile scraping хийхгүй. Олон хэрэглэгчтэй production орчинд Монголын OSM vector tile-ийг Planetiler/PMTiles зэрэг нээлттэй хэрэгслээр урьдчилан үүсгэж, их сургуулийн дэд бүтцэд өөрсдөө host хийхээр төлөвлөсөн.

Дэлгэрэнгүй шийдвэр, өгөгдлийн хязгаарлалт, дараагийн үе шатыг `PROJECT_ARCHITECTURE.md`, хөгжүүлэлтийн дүрмийг `AGENTS.md`-ээс харна уу.
