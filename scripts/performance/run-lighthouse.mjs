import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  fileExists,
  performancePath,
  startProductionServer,
} from "./process-utils.mjs";

const LIGHTHOUSE_VERSION = "12.8.2";
const outputDirectory = path.join(process.cwd(), ".next", "performance");
const reportBase = path.join(outputDirectory, "lighthouse");

function percentage(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Lighthouse exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function lighthouseCommand() {
  const localCli = path.join(
    process.cwd(),
    "node_modules",
    "lighthouse",
    "cli",
    "index.js",
  );
  if (await fileExists(localCli)) {
    return { command: process.execPath, prefix: [localCli] };
  }

  // Keep a large audit-only dependency out of the application bundle. npm
  // caches this pinned tool after the first run.
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error(
      "npm_execpath is unavailable. Run this check through `npm run perf:lighthouse`.",
    );
  }
  return {
    command: process.execPath,
    prefix: [
      npmCli,
      "exec",
      "--yes",
      `--package=lighthouse@${LIGHTHOUSE_VERSION}`,
      "--",
      "lighthouse",
    ],
  };
}

const server = await startProductionServer();
try {
  await mkdir(outputDirectory, { recursive: true });
  const target = new URL(performancePath(), server.origin).href;
  const executable = await lighthouseCommand();
  console.log(`Auditing ${target}`);
  await run(executable.command, [
    ...executable.prefix,
    target,
    "--quiet",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=html",
    "--output=json",
    `--output-path=${reportBase}`,
    "--chrome-flags=--headless=new --disable-extensions --no-first-run",
  ]);

  const reportPath = `${reportBase}.report.json`;
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const categories = report.categories;
  const audits = report.audits;
  const summary = {
    performance: percentage(categories.performance?.score),
    accessibility: percentage(categories.accessibility?.score),
    bestPractices: percentage(categories["best-practices"]?.score),
    seo: percentage(categories.seo?.score),
    largestContentfulPaintMs: Math.round(
      audits["largest-contentful-paint"]?.numericValue ?? 0,
    ),
    cumulativeLayoutShift: Number(
      (audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3),
    ),
    totalBlockingTimeMs: Math.round(
      audits["total-blocking-time"]?.numericValue ?? 0,
    ),
  };
  console.log("Lighthouse summary:");
  console.table(summary);
  console.log(`HTML report: ${reportBase}.report.html`);
  console.log(`JSON report: ${reportPath}`);

  const failures = [];
  if ((categories.performance?.score ?? 0) < 0.85) failures.push("performance < 85%");
  if ((categories.accessibility?.score ?? 0) < 0.95) failures.push("accessibility < 95%");
  if ((categories["best-practices"]?.score ?? 0) < 0.9) failures.push("best practices < 90%");
  if ((categories.seo?.score ?? 0) < 0.9) failures.push("SEO < 90%");
  if ((audits["largest-contentful-paint"]?.numericValue ?? Infinity) > 2_500) {
    failures.push("LCP > 2500 ms");
  }
  if ((audits["cumulative-layout-shift"]?.numericValue ?? Infinity) > 0.1) {
    failures.push("CLS > 0.1");
  }
  if ((audits["total-blocking-time"]?.numericValue ?? Infinity) > 200) {
    failures.push("TBT > 200 ms");
  }
  if (failures.length) {
    throw new Error(`Performance budget failed: ${failures.join(", ")}`);
  }
} finally {
  await server.stop();
}
