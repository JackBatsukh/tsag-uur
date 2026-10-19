"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="route-state page-shell">
      <div className="route-state__panel" role="alert">
        <span className="route-state__code">Алдаа</span>
        <h1>Хяналтын самбарыг харуулахад асуудал гарлаа</h1>
        <p>
          Түр зуурын алдаа гарсан байж болзошгүй. Дахин оролдох эсвэл хуудсыг шинээр ачаална уу.
        </p>
        <button type="button" onClick={reset}>
          Дахин оролдох
        </button>
      </div>
    </main>
  );
}
