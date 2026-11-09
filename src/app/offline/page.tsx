import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Офлайн горим",
  description: "Tsag-uur сүлжээгүй үеийн хөнгөн fallback хуудас.",
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <p className="eyebrow">Lite Mode · offline</p>
      <h1>Сүлжээ холбогдоогүй байна</h1>
      <p>
        Шууд цаг агаарын мэдээллийг шинэчилж чадсангүй. Өмнө нээсэн хуудас
        cache-д байвал browser-ийн буцах товчоор ашиглаж болно. Cache-д байгаа
        мэдээллийг шинэ forecast гэж үзэхгүй бөгөөд огноо, хүчинтэй хугацааг
        заавал шалгана уу.
      </p>
      <div className="offline-page__actions">
        <Link href="/">Дахин оролдох</Link>
        <Link href="/dashboard">Текстэн demo самбар</Link>
      </div>
    </main>
  );
}
