import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

async function waitForCondition(client, expression, timeoutMs = 12_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function collectMemorySnapshot(client, label) {
  await client.send("HeapProfiler.collectGarbage");
  const [dom, performance] = await Promise.all([
    client.send("Memory.getDOMCounters"),
    client.send("Performance.getMetrics"),
  ]);
  const metrics = Object.fromEntries(
    performance.metrics.map((item) => [item.name, item.value]),
  );
  const runtime = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const listeners = typeof getEventListeners === "function"
        ? [window, document].reduce((total, target) => total + Object.values(getEventListeners(target))
          .reduce((count, entries) => count + entries.length, 0), 0)
        : null;
      const canvases = [...document.querySelectorAll("canvas")];
      return {
        connectedElements: document.querySelectorAll("*").length,
        listeners,
        mapHosts: document.querySelectorAll(".maplibregl-map").length,
        mapCanvases: document.querySelectorAll(".maplibregl-canvas").length,
        canvases: canvases.length,
        canvasPixels: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
      };
    })()`,
    includeCommandLineAPI: true,
    returnByValue: true,
  });

  let detachedNodes = null;
  let detachedNodeDetails = [];
  try {
    const detached = await client.send("DOM.getDetachedDomNodes", {
      enableDetailedInfo: true,
    });
    detachedNodes = detached.detachedNodes?.length ?? 0;
    detachedNodeDetails = (detached.detachedNodes ?? []).map((item) => ({
      nodeName: item.treeNode?.nodeName ?? "unknown",
      childNodeCount: item.treeNode?.childNodeCount ?? 0,
      attributes: item.treeNode?.attributes ?? [],
      retainedNodeCount: item.retainedNodeIds?.length ?? 0,
    }));
  } catch {
    // Older Chromium builds may not expose this experimental CDP command.
  }

  return {
    label,
    jsHeapUsedMb: Number(((metrics.JSHeapUsedSize ?? 0) / 1_048_576).toFixed(2)),
    documents: dom.documents,
    nodes: dom.nodes,
    jsEventListeners: dom.jsEventListeners,
    detachedNodes,
    detachedNodeDetails,
    ...runtime.result.value,
  };
}

async function runInteractionProfile(client) {
  const snapshots = [];
  const researcherModeDisabled = await evaluate(
    client,
    `(() => [...document.querySelectorAll(".mode-grid button")]
      .some((button) => button.disabled && button.textContent.includes("Судлаач")))()`,
  );
  if (!researcherModeDisabled) {
    throw new Error("Researcher mode must remain visibly unavailable.");
  }
  await evaluate(
    client,
    `(async () => {
      const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (predicate, timeoutMs = 5_000) => {
        const startedAt = performance.now();
        while (!predicate() && performance.now() - startedAt < timeoutMs) {
          await pause(100);
        }
        return predicate();
      };
      for (const button of document.querySelectorAll(".layer-option:not(:disabled)")) {
        button.click();
        await pause(120);
      }
      const liteToggle = document.querySelector(".sidebar-toggles input[type=checkbox]");
      for (let index = 0; index < 3 && liteToggle; index += 1) {
        if (liteToggle.checked) liteToggle.click();
        await waitFor(() => Boolean(document.querySelector(".maplibregl-canvas")));
        document.querySelector(".maplibregl-ctrl-zoom-in")?.click();
        await pause(100);
        document.querySelector(".maplibregl-ctrl-zoom-out")?.click();
        await pause(100);
        if (index < 2) {
          liteToggle.click();
          await waitFor(() => !document.querySelector(".maplibregl-canvas"));
        }
      }
      return true;
    })()`,
  );

  const routes = [
    [".mode-grid a[href='/herder']", "/herder", ".herder-app"],
    [".explorer-link[href='/']", "/", ".weather-explorer"],
    [".mode-grid a[href='/farmer']", "/farmer", ".farmer-app"],
    [".farmer-brand[href='/']", "/", ".weather-explorer"],
  ];
  const navigationCycles = Number(process.env.TSAG_UUR_PERF_NAV_CYCLES ?? 2);
  for (let cycle = 0; cycle < navigationCycles; cycle += 1) {
    for (const [selector, pathname, readySelector] of routes) {
      const clicked = await evaluate(
        client,
        `(() => { const target = document.querySelector(${JSON.stringify(selector)}); target?.click(); return Boolean(target); })()`,
      );
      if (!clicked) throw new Error(`Could not find navigation target ${selector}.`);
      await waitForCondition(
        client,
        `location.pathname === ${JSON.stringify(pathname)} && Boolean(document.querySelector(${JSON.stringify(readySelector)}))`,
      );
      if (pathname === "/herder") {
        await evaluate(
          client,
          `(() => { const buttons = document.querySelectorAll(".herder-bottom-nav button"); buttons[1]?.click(); buttons[0]?.click(); return true; })()`,
        );
      }
      if (pathname === "/farmer") {
        await evaluate(
          client,
          `(() => { document.querySelector("#farmer-map")?.scrollIntoView({ block: "center" }); return true; })()`,
        );
        await waitForCondition(
          client,
          `Boolean(document.querySelector(".farmer-map-frame .maplibregl-canvas")) && !document.querySelector(".farmer-map-frame .map-state")`,
        );
      }
    }
    snapshots.push(await collectMemorySnapshot(client, `navigation-cycle-${cycle + 1}`));
  }
  await waitForCondition(
    client,
    `Boolean(document.querySelector(".maplibregl-canvas")) && !document.querySelector(".map-state")`,
  );
  return snapshots;
}

const server = await startProductionServer();
const viewportWidth = Number(process.env.TSAG_UUR_PERF_WIDTH ?? 390);
const viewportHeight = Number(process.env.TSAG_UUR_PERF_HEIGHT ?? 844);
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
  const browserErrors = [];
  client.on("Page.lifecycleEvent", (event) => lifecycle.push(event.name));
  client.on("Runtime.exceptionThrown", (event) => {
    const details = event.exceptionDetails ?? {};
    pageErrors.push({
      text: details.text ?? "Uncaught browser exception",
      description: details.exception?.description ?? details.exception?.value ?? "",
      url: details.url ?? "",
      line: details.lineNumber ?? null,
      column: details.columnNumber ?? null,
    });
  });
  client.on("Network.loadingFailed", (event) => {
    if (!event.canceled && event.errorText !== "net::ERR_ABORTED") {
      failedRequests.push(event.errorText);
    }
  });
  client.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") browserErrors.push(entry.text);
  });

  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable"),
    client.send("Performance.enable"),
    client.send("HeapProfiler.enable"),
    client.send("DOM.enable"),
    client.send("Log.enable"),
    client.send("Page.setLifecycleEventsEnabled", { enabled: true }),
    client.send("Emulation.setDeviceMetricsOverride", {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: viewportWidth <= 768,
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
      try { localStorage.setItem("tsag-uur-lite-mode-v2", ${JSON.stringify(String(liteMode))}); } catch {}
      globalThis.__tsagUurPerf = {
        lcp: 0,
        lcpElement: "",
        lcpEntries: [],
        dataReadyMs: 0,
        cls: 0,
        longTaskCount: 0,
        longTaskDuration: 0,
      };
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const element = entry.element;
            globalThis.__tsagUurPerf.lcp = entry.startTime;
            globalThis.__tsagUurPerf.lcpElement = element
              ? element.tagName.toLowerCase() + "." + String(element.className || "").trim()
              : "";
            globalThis.__tsagUurPerf.lcpEntries.push({
              time: entry.startTime,
              size: entry.size,
              element: globalThis.__tsagUurPerf.lcpElement,
              text: element?.textContent?.trim().slice(0, 120) || "",
            });
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        const observeDataStatus = () => {
          const status = document.querySelector("[data-weather-status]");
          if (!status) return;
          const recordReady = () => {
            if (status.getAttribute("data-weather-status") !== "loading") {
              globalThis.__tsagUurPerf.dataReadyMs ||= performance.now();
            }
          };
          recordReady();
          new MutationObserver(recordReady).observe(status, {
            attributes: true,
            attributeFilter: ["data-weather-status"],
          });
        };
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", observeDataStatus, { once: true });
        } else {
          observeDataStatus();
        }
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
  await evaluate(
    client,
    `(async () => {
      const fullMap = ${JSON.stringify(!liteMode)};
      const startedAt = performance.now();
      while (performance.now() - startedAt < 12_000) {
        const dataReady = document.querySelector("[data-weather-status]")
          ?.getAttribute("data-weather-status") !== "loading";
        const mapReady = fullMap
          ? Boolean(document.querySelector(".maplibregl-canvas")) && !document.querySelector(".map-state")
          : Boolean(document.querySelector(".lite-map"));
        if (dataReady && mapReady) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`,
  );

  const frameMetrics = liteMode
    ? null
    : await evaluate(
        client,
        `(async () => {
          const intervals = [];
          let previous;
          await new Promise((resolve) => {
            const sample = (timestamp) => {
              if (previous !== undefined) intervals.push(timestamp - previous);
              previous = timestamp;
              if (intervals.length >= 90) resolve();
              else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          });
          const sorted = [...intervals].sort((a, b) => a - b);
          const averageMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
          return {
            sampleCount: intervals.length,
            averageMs,
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            maximumMs: sorted[sorted.length - 1] ?? 0,
            averageFps: 1000 / averageMs,
          };
        })()`,
      );

  const memorySnapshots = [await collectMemorySnapshot(client, "settled")];
  if (process.env.TSAG_UUR_PERF_INTERACTIONS === "1") {
    memorySnapshots.push(...await runInteractionProfile(client));
    memorySnapshots.push(await collectMemorySnapshot(client, "after-interactions"));
  }

  const browserMetrics = await evaluate(
    client,
    `(async () => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const dimensions = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          backingWidth: "width" in element ? element.width : null,
          backingHeight: "height" in element ? element.height : null,
        };
      };
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
          names: resources.map((item) => item.name),
        },
        map: {
          litePreference: localStorage.getItem("tsag-uur-lite-mode-v2"),
          weatherMapCount: document.querySelectorAll(".weather-map").length,
          mapCanvasCount: document.querySelectorAll(".maplibregl-canvas").length,
          basemapSize: (() => {
            const basemap = document.querySelector(".weather-map__basemap");
            if (!basemap) return null;
            const bounds = basemap.getBoundingClientRect();
            return {
              width: Math.round(bounds.width),
              height: Math.round(bounds.height),
            };
          })(),
          liteMapCount: document.querySelectorAll(".lite-map").length,
          stateText: document.querySelector(".map-state")?.textContent?.trim() ?? "",
          dataKind: document.querySelector("[data-weather-status]")?.getAttribute("data-weather-status") ?? "",
          dimensions: {
            stage: dimensions(document.querySelector(".map-stage")),
            host: dimensions(document.querySelector(".weather-map__basemap")),
            mapCanvas: dimensions(document.querySelector(".maplibregl-canvas")),
            overlay: dimensions(document.querySelector(".weather-map__overlay")),
          },
        },
        serviceWorkerReady,
      };
    })()`,
  );
  const screenshotSetting = process.env.TSAG_UUR_PERF_SCREENSHOT;
  let screenshotPath = null;
  if (screenshotSetting) {
    screenshotPath = path.resolve(screenshotSetting);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    const capture = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(screenshotPath, Buffer.from(capture.data, "base64"));
  }
  const cdpMetrics = await client.send("Performance.getMetrics");
  const metric = Object.fromEntries(cdpMetrics.metrics.map((item) => [item.name, item.value]));
  const summary = {
    ...browserMetrics,
    paint: {
      lcpMs: Math.round(browserMetrics.paint.lcp),
      lcpElement: browserMetrics.paint.lcpElement,
      lcpEntries: browserMetrics.paint.lcpEntries,
      dataReadyMs: Math.round(browserMetrics.paint.dataReadyMs),
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
    frames: frameMetrics
      ? {
          sampleCount: frameMetrics.sampleCount,
          averageMs: Number(frameMetrics.averageMs.toFixed(2)),
          p95Ms: Number(frameMetrics.p95Ms.toFixed(2)),
          maximumMs: Number(frameMetrics.maximumMs.toFixed(2)),
          averageFps: Number(frameMetrics.averageFps.toFixed(1)),
        }
      : null,
    memorySnapshots,
    lifecycle: [...new Set(lifecycle)],
    pageErrors,
    browserErrors,
    failedRequests,
    screenshotPath,
  };
  if (process.env.TSAG_UUR_PERF_JSON) {
    const jsonPath = path.resolve(process.env.TSAG_UUR_PERF_JSON);
    await mkdir(path.dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.dir(summary, { depth: null });

  const failures = [];
  if (summary.readyState !== "complete") failures.push("document did not complete");
  if (!process.env.TSAG_UUR_PERF_URL && !summary.serviceWorkerReady) {
    failures.push("service worker did not become ready");
  }
  if (
    process.env.TSAG_UUR_PERF_INTERACTIONS !== "1"
    && (summary.paint.lcpMs <= 0 || summary.paint.lcpMs > 2_500)
  ) failures.push("LCP budget failed");
  if (summary.paint.cls > 0.1) failures.push("CLS budget failed");
  if (pageErrors.length) failures.push(`${pageErrors.length} browser exception(s)`);
  if (failedRequests.length) failures.push(`${failedRequests.length} failed request(s)`);
  if (liteMode && summary.resources.mapRequests.length) {
    failures.push("Lite Mode fetched MapLibre or OpenStreetMap resources");
  }
  if (!liteMode && summary.map.mapCanvasCount !== 1) {
    failures.push("interactive map canvas did not initialize");
  }
  if (
    !liteMode &&
    (!summary.map.basemapSize ||
      summary.map.basemapSize.width <= 0 ||
      summary.map.basemapSize.height <= 0)
  ) {
    failures.push("interactive map container has no visible area");
  }
  if (!liteMode && summary.map.stateText) {
    failures.push("interactive map did not reach its ready state");
  }
  if (!liteMode) {
    const { stage, host, mapCanvas, overlay } = summary.map.dimensions;
    const fillsStage = (value) => value
      && stage
      && Math.abs(value.width - stage.width) <= 2
      && Math.abs(value.height - stage.height) <= 2;
    if (![host, mapCanvas, overlay].every(fillsStage)) {
      failures.push("map canvases do not fill the map stage");
    }
  }
  if (!liteMode && !summary.resources.mapRequests.some((url) => /tile\.openstreetmap\.org/i.test(url))) {
    failures.push("OpenStreetMap tiles were not requested");
  }
  if (!liteMode && summary.frames && summary.frames.averageMs > 34) {
    failures.push("average animation frame budget exceeded 34 ms");
  }
  if (failures.length) throw new Error(`Lifecycle check failed: ${failures.join(", ")}`);
} finally {
  client?.close();
  await browser?.stop();
  await server.stop();
}
