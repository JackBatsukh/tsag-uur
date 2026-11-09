import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access } from "node:fs/promises";
import path from "node:path";

const LOOPBACK = "127.0.0.1";

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, LOOPBACK, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a local port.")));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

export async function waitForHttp(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
      lastError = new Error(`Server returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Timed out waiting for ${url}.${lastError instanceof Error ? ` ${lastError.message}` : ""}`,
  );
}

export async function startProductionServer() {
  const configuredUrl = process.env.TSAG_UUR_PERF_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    await waitForHttp(url.origin);
    return { origin: url.origin, stop: async () => undefined };
  }

  const projectRoot = process.cwd();
  const buildId = path.join(projectRoot, ".next", "BUILD_ID");
  if (!(await fileExists(buildId))) {
    throw new Error(
      "No production build found. Run `npm run build` before the performance checks.",
    );
  }

  const port = await findFreePort();
  const origin = `http://${LOOPBACK}:${port}`;
  const nextCli = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const output = [];
  const child = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", LOOPBACK, "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  try {
    await Promise.race([
      waitForHttp(origin),
      new Promise((_, reject) => {
        child.once("exit", (code) => {
          reject(
            new Error(
              `Next.js exited before it became ready (code ${code ?? "unknown"}).\n${output.join("")}`,
            ),
          );
        });
      }),
    ]);
  } catch (error) {
    child.kill();
    throw error;
  }

  return {
    origin,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
    },
  };
}

export function performancePath() {
  const configuredPath = process.env.TSAG_UUR_PERF_PATH ?? "/";
  if (!configuredPath.startsWith("/")) {
    throw new Error("TSAG_UUR_PERF_PATH must start with '/'.");
  }
  return configuredPath;
}
