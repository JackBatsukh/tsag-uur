# Малчин горим 2.0 — хэрэгжүүлэлтийн эцсийн тайлан

**Огноо:** 2026-11-16  
**Зам:** `/herder`

## 1. Хэрэгжүүлсэн боломж

- Нүүр дэлгэц дээр шууд ойлгогдох зургаан том үйлдэл: хүн хайх, мал хайх, SOS, гал түймэр, цаг агаар, замын сэрэмжлүүлэг.
- 44 px-ээс том touch target, өндөр contrast, SVG sprite icon, reduced-motion ба mobile bottom navigation.
- SOS: 101/102/103/105 `tel:` холбоос; төрөл, тайлбар, optional байршил; preview; copy, native share, `sms:` fallback; offline заавар.
- Мал хайх: зургаан төрөл, тоо, цаг, газар, таних тэмдэг, координат, хэрэглэгчийн сонгосон хайх зай, итгэлтэй хүн шаардах validation, manual share.
- Архивлагдсан салхи/цас/тунадасны туслах шинжилгээ болон зөвхөн хүссэн үед lazy MapLibre хайлтын зураг.
- Сураггүй хүн: зөвшөөрөл шаардах, browser-local дотоод төлөвлөгөө; хүүхэд/эмзэг хүний тэмдэглэгээ; public database болон автомат нийтлэл байхгүй.
- NASA FIRMS VIIRS SNPP NRT server adapter: Монголын bounding box, UTC timestamp normalization, cache, timeout, attribution, credential gate.
- Замын төлөв: явах/очих хоёр цэгийн 12 цагийн салхи, тунадас, үзэгдэх орчны тойм; route/closure гэж худал нэрлэхгүй.
- Олон нийтийн report/correction: category, time, description, ерөнхий газар, correction reference; зөвхөн local `Draft` төлөв.
- Итгэлтэй хүмүүс ба локал ноорог устгах хяналт бүхий “Миний хэсэг”.
- Service Worker `/herder` public shell-ийг offline уншихад хадгална; `/api/*` болон эмзэг payload-ийг cache хийхгүй.

## 2. Дэлгэц ба урсгал

- Нүүр → зургаан үндсэн ажил эсвэл доод цэс.
- SOS → ангилал/тайлбар/байршил → preview → хэрэглэгчийн баталсан call/copy/share/SMS.
- Мал → локал ноорог → итгэлтэй хүн validation → preview → manual share; хүсвэл архив → хайлтын бүс → lazy map.
- Хүн → эрх/зөвшөөрөл → дотоод ноорог → төхөөрөмжид хадгалах; нийтлэх товч зориудаар байхгүй.
- Гал → server adapter төлөв → configured үед satellite hotspot list; key байхгүй үед хоосон “тохируулаагүй” төлөв.
- Зам → хоёр endpoint → Open-Meteo forecast summary → тодорхой uncertainty.
- Report → local Draft; moderation backend байхгүй үед Submitted/Verified төлөв үүсгэхгүй.

## 3. Ажиллаж буй интеграц

- Open-Meteo Best Match forecast: одоогийн болон 24 цагийн төлөв.
- Open-Meteo архивлагдсан цагийн загвар: мал хайх weather influence.
- Device geolocation: зөвшөөрөлтэй үед optional; бүх form гараар координат оруулах боломжтой.
- Native browser APIs: Clipboard, Web Share, `sms:`, `tel:`, `localStorage`, Service Worker.
- NASA FIRMS adapter код ажиллаж байгаа; бодит hotspot авахын тулд server-side key хэрэгтэй.

## 4. Credential/backend хүлээж буй зүйл

- `NASA_FIRMS_MAP_KEY`: байхгүй үед fake hotspot үзүүлэхгүй.
- `VERIFY_MN_API_KEY`: `.env.example`-д байгаа ч real session flow зориудаар disabled. Verify.mn нь хэрэглэгчээс 144773 руу очих mobile-originated verification бөгөөд outbound alert provider биш.
- Neighbor outbound SMS/push: provider, opt-in registry, delivery webhook, rate limit, abuse control байхгүй тул идэвхгүй.
- Missing-person public publishing, photo upload, access control, moderation, removal request: secure backend хүртэл идэвхгүй.
- Official Mongolian fire warnings and road closures: эрх бүхий source/API холбогдоогүй.

## 5. Security ба privacy

- Эмзэг draft browser-local; API cache болон Service Worker cache-д орохгүй.
- Missing-person draft зөвшөөрөлгүй хадгалагдахгүй.
- Exact private location-ийг public feed рүү нийтлэх зам байхгүй.
- API key зөвхөн server environment variable; `NEXT_PUBLIC_` ашиглахгүй.
- Delivery state нь manual provider дээр `ready/unknown`; provider confirmation-гүй `sent/delivered` харуулахгүй.
- NASA цэгийг official wildfire boundary гэж нэрлэхгүй; synthetic emergency alert үүсгэхгүй.
- App-specific local data deletion control хэрэгжсэн.

## 6. JavaScript bundle

- Herder initial JS **512,043 → 490,027 bytes**, **−4.3%**.
- Safety views dynamic chunk; үндсэн home дээр зөвхөн home shell ачаална.
- Root map link prefetch disabled; хэрэглэгч товших хүртэл explorer route татахгүй.
- MapLibre зөвхөн малын хайлтын map-ийг нээхэд dynamic import болно.
- Нийт build шинэ lazy feature chunk-уудаас болж өссөн ч initial Herder transfer буурсан. Дэлгэрэнгүй: `PERFORMANCE_REPORT.md`.

## 7. DOM ба memory

- Throttled mobile home: **455 DOM node**, **2.55 MB JS heap**, **12 resource**, **0 map request**.
- LCP **1,228 ms**, CLS **0**, browser exception/failed request **0**.
- Full interactive map-ийн тусдаа heap/canvas audit дараагийн hardening ажил.

## 8. Test үр дүн

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm test` — 27/27 pass.
- `npm run build` — pass.
- `npm run perf:lifecycle` (`/herder`) — pass.
- `npm run perf:lighthouse` (`/herder`) — pass: 98/100/100/100; LCP 2,287 ms; CLS 0; TBT 65 ms.
- Visible browser host unavailable тул гар ажиллагаатай screenshot QA хийгдээгүй.

## 9. Үлдсэн асуудал

- Authentication, server persistence, moderation queue, audit log, retention policy байхгүй.
- Real delivery provider болон баталгаатай delivery receipt байхгүй.
- Official fire/road/weather warning feed байхгүй.
- Road routing engine байхгүй; endpoint forecast нь замын дундах нөхцөлийг төлөөлөхгүй.
- Image upload/consent/access control хэрэгжээгүй.
- Map-heavy workflow-ийн memory болон low-end Android device test дутуу.

## 10. Production-д оруулах дараалал

1. Authenticated backend, role/access control, encryption, retention/deletion, rate limiting, audit log.
2. Missing-person moderation, guardian/authority workflow, removal болон abuse response.
3. Opt-in trusted-contact registry + supported outbound provider + signed delivery webhook.
4. NASA FIRMS production key monitoring, quota/circuit breaker; official Монгол warning feed-ийг тусдаа provenance-тай нэмэх.
5. Баталгаатай routing/road closure эх сурвалж, route-weather sampling.
6. Low-end Android field test, Mongolian herder usability session, offline/reconnect scenario, production RUM.
