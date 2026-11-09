import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  fileExists,
  findFreePort,
  performancePath,
  startProductionServer,
  waitForHttp,
} from "./process-utils.mjs";

class CdpClient {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Map();

  static async connect(url) {
    const client = new CdpClient();
    client.#socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      client.#socket.addEventListener("open", resolve, { once: true });
      client.#socket.addEventListener("error", reject, { once: true });
    });
    client.#socket.addEventListener("message", (event) => client.#onMessage(event));
    return client;
  }

  on(method, listener) {
    const listeners = this.#listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.#nextId++;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
    });
  }

  waitFor(method, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(listener);
        reject(new Error(`Timed out waiting for CDP event ${method}.`));
      }, timeoutMs);
      const listener = (params) => {
        clearTimeout(timer);
        listeners.delete(listener);
        resolve(params);
      };
      const listeners = this.#listeners.get(method) ?? new Set();
      listeners.add(listener);
      this.#listeners.set(method, listeners);
    });
  }

  close() {
    this.#socket.close();
  }

  #onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    for (const listener of this.#listeners.get(message.method) ?? []) {
      listener(message.params);
    }
  }
}

async function browserExecutable() {
  const candidates = [
    process.env.TSAG_UUR_CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error(
    "Chrome/Edge was not found. Set TSAG_UUR_CHROME_PATH to a Chromium executable.",
  );
}

async function launchBrowser() {
  const executable = await browserExecutable();
  const port = await findFreePort();
  const profile = await mkdtemp(path.join(os.tmpdir(), "tsag-uur-perf-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  try {
    await waitForHttp(`http://127.0.0.1:${port}/json/version`);
  } catch (error) {
    child.kill();
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
  return {
    port,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed.");
  }
  return result.result.value;
}

const server = await startProductionServer();
let browser;
let client;
try {
  browser = await launchBrowser();
  const targetUrl = `http://127.0.0.1:${browser.port}/json/new?${encodeURIComponent("about:blank")}`;
  const targetResponse = await fetch(targetUrl, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not create browser target (${targetResponse.status}).`);
  const targetInfo = await targetResponse.json();
  client = await CdpClient.connect(targetInfo.webSocketDebuggerUrl);

  const lifecycle = [];
  const pageErrors = [];
  const failedRequests = [];
  client.on("Page.lifecycleEvent", (event) => lifecycle.push(event.name));
  client.on("Runtime.exceptionThrown", (event) => {
    pageErrors.push(event.exceptionDetails?.text ?? "Uncaught browser exception");
  });
  client.on("Network.loadingFailed", (event) => {
    if (!event.canceled && event.errorText !== "net::ERR_ABORTED") {
      failedRequests.push(event.errorText);
    }
  });

  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable"),
    client.send("Performance.enable"),
    client.send("Log.enable"),
    client.send("Page.setLifecycleEventsEnabled", { enabled: true }),
    client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    }),
    client.send("Emulation.setCPUThrottlingRate", { rate: 4 }),
    client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: "cellular4g",
    }),
  ]);

  const liteMode = process.env.TSAG_UUR_PERF_LITE !== "0";
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try { localStorage.setItem("tsag-uur-lite-mode", ${JSON.stringify(String(liteMode))}); } catch {}
      globalThis.__tsagUurPerf = { lcp: 0, cls: 0, longTaskCount: 0, longTaskDuration: 0 };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) globalThis.__tsagUurPerf.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) globalThis.__tsagUurPerf.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            globalThis.__tsagUurPerf.longTaskCount += 1;
            globalThis.__tsagUurPerf.longTaskDuration += entry.duration;
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    `,
  });

  const target = new URL(performancePath(), server.origin).href;
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url: target });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 3_000));

  const browserMetrics = await evaluate(
    client,
    `(async () => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const serviceWorkerReady = "serviceWorker" in navigator
        ? await Promise.race([
            navigator.serviceWorker.ready.then(() => true).catch(() => false),
            new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
          ])
        : false;
      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        navigation: navigation ? {
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          loadMs: navigation.loadEventEnd,
          transferSize: navigation.transferSize,
        } : null,
        paint: globalThis.__tsagUurPerf,
        resources: {
          count: resources.length,
          transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
          scriptBytes: resources.filter((item) => item.initiatorType === "script")
            .reduce((sum, item) => sum + (item.transferSize || 0), 0),
          mapRequests: resources.filter((item) => /maplibre|tile\\.openstreetmap\\.org/i.test(item.name))
            .map((item) => item.name),
        },
        serviceWorkerReady,
      };
    })()`,
  );
  const cdpMetrics = await client.send("Performance.getMetrics");
  const metric = Object.fromEntries(cdpMetrics.metrics.map((item) => [item.name, item.value]));
  const summary = {
    ...browserMetrics,
    paint: {
      lcpMs: Math.round(browserMetrics.paint.lcp),
      cls: Number(browserMetrics.paint.cls.toFixed(3)),
      longTaskCount: browserMetrics.paint.longTaskCount,
      longTaskDurationMs: Math.round(browserMetrics.paint.longTaskDuration),
    },
    cdp: {
      jsHeapUsedMb: Number(((metric.JSHeapUsedSize ?? 0) / 1_048_576).toFixed(2)),
      taskDurationMs: Math.round((metric.TaskDuration ?? 0) * 1_000),
      scriptDurationMs: Math.round((metric.ScriptDuration ?? 0) * 1_000),
      nodes: metric.Nodes ?? 0,
    },
    lifecycle: [...new Set(lifecycle)],
    pageErrors,
    failedRequests,
  };
  console.dir(summary, { depth: null });

  const failures = [];
  if (summary.readyState !== "complete") failures.push("document did not complete");
  if (!summary.serviceWorkerReady) failures.push("service worker did not become ready");
  if (summary.paint.lcpMs <= 0 || summary.paint.lcpMs > 2_500) failures.push("LCP budget failed");
  if (summary.paint.cls > 0.1) failures.push("CLS budget failed");
  if (pageErrors.length) failures.push(`${pageErrors.length} browser exception(s)`);
  if (failedRequests.length) failures.push(`${failedRequests.length} failed request(s)`);
  if (liteMode && summary.resources.mapRequests.length) {
    failures.push("Lite Mode fetched MapLibre or OpenStreetMap resources");
  }
  if (failures.length) throw new Error(`Lifecycle check failed: ${failures.join(", ")}`);
} finally {
  client?.close();
  await browser?.stop();
  await server.stop();
}
