"use client";

import { useReportWebVitals } from "next/web-vitals";

interface WebVitalsReporterProps {
  /** Same-origin endpoint only, for example /api/metrics/web-vitals. */
  readonly endpoint: string;
}

export function WebVitalsReporter({ endpoint }: WebVitalsReporterProps) {
  useReportWebVitals((metric) => {
    if (!endpoint.startsWith("/") || navigator.doNotTrack === "1") return;

    const body = JSON.stringify({
      version: 1,
      name: metric.name,
      id: metric.id,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
      // Query parameters are intentionally excluded: user-entered coordinates
      // and other browser-local values must never enter performance telemetry.
      path: window.location.pathname,
    });

    if (!navigator.sendBeacon(endpoint, body)) {
      void fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      }).catch(() => undefined);
    }
  });

  return null;
}
