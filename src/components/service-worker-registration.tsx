"use client";

import { useEffect } from "react";

/**
 * Registration is deliberately delayed until after load/idle so it never
 * competes with the first render. The worker caches no API, location, or map
 * tile requests; see public/sw.js for the bounded allow-list.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    if (process.env.NODE_ENV !== "production") {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
          registrations
            .filter((registration) => registration.scope.startsWith(window.location.origin))
            .map((registration) => registration.unregister()),
        )),
        "caches" in window
          ? window.caches.keys().then((keys) => Promise.all(
              keys.filter((key) => key.startsWith("tsag-uur-")).map((key) => window.caches.delete(key)),
            ))
          : Promise.resolve([]),
      ]);
      return;
    }

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Offline support is progressive enhancement. A failed registration
        // must not prevent access to live weather information.
      });
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const schedule = () => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(register);
      } else {
        timeoutId = window.setTimeout(register, 1_500);
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
