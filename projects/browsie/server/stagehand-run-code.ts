import fsp from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { ExperimentalBatchCallback, Page, Stagehand } from "@browserbasehq/stagehand";

import {
  createPlaywrightCompatRuntime,
  type PlaywrightCompatTelemetry,
} from "./stagehand-facade-runtime.js";

type ScreenshotArtifact = { path: string; base64: string };
type RunEnvelope = {
  __stagehandPlaywrightCompat: true;
  value: unknown;
  executionError?: { name: string; message: string; stack?: string };
  telemetry: PlaywrightCompatTelemetry;
  artifacts: ScreenshotArtifact[];
  closeRequested: boolean;
  batchRuntimeMs: number;
};

export interface StagehandCodeRunResult {
  value: unknown;
  closeRequested: boolean;
  telemetry: PlaywrightCompatTelemetry;
  batchRuntimeMs: number;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

const RUN_BATCH_TIMEOUT_MS = 60_000;

const FACADE_PRELUDE = `"use strict";
const __stagehandCompatIdentity = (target) => target;
for (let index = 0; index <= 32; index += 1) {
  globalThis[index === 0 ? "__name" : "__name" + index] = __stagehandCompatIdentity;
}
const createRuntime = ${createPlaywrightCompatRuntime.toString()};
const runtime = await createRuntime(batchStagehand, { hiddenPageIds: [] });
const page = runtime.page;
const context = runtime.context;
const browser = runtime.browser;
const console = globalThis.console;
const __stagehandBatchStartedAt = performance.now();
let value;
let executionError;
try {
  value = await (async () => { `;

const FACADE_EPILOGUE = `
  })();
} catch (error) {
  executionError = {
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string" ? error.message : String(error),
    ...(typeof error?.stack === "string" ? { stack: error.stack } : {}),
  };
}
return {
  __stagehandPlaywrightCompat: true,
  value,
  executionError,
  telemetry: runtime.telemetry(),
  artifacts: runtime.artifacts(),
  closeRequested: runtime.closeRequested(),
  batchRuntimeMs: performance.now() - __stagehandBatchStartedAt,
};`;

export async function executeStagehandCode(options: {
  stagehand: Stagehand;
  page: Page;
  code: string;
  artifactRoot: string;
}): Promise<StagehandCodeRunResult> {
  const callback = new AsyncFunction(
    "batchStagehand",
    "input",
    FACADE_PRELUDE + options.code + FACADE_EPILOGUE,
  ) as ExperimentalBatchCallback<Record<string, never>, RunEnvelope>;
  const envelope = await options.stagehand.experimentalBatch(
    callback,
    {},
    {
      page: options.page,
      timeout: RUN_BATCH_TIMEOUT_MS,
    },
  );
  await writeScreenshotArtifacts(envelope.artifacts, options.artifactRoot);
  if (envelope.executionError) {
    const error = new Error(sanitizeErrorMessage(envelope.executionError.message));
    error.name = /^[A-Za-z][A-Za-z0-9]*Error$/u.test(envelope.executionError.name)
      ? envelope.executionError.name
      : "Error";
    error.stack = undefined;
    throw error;
  }
  return {
    value: envelope.value,
    closeRequested: envelope.closeRequested,
    telemetry: envelope.telemetry,
    batchRuntimeMs: envelope.batchRuntimeMs,
  };
}

async function writeScreenshotArtifacts(
  artifacts: ScreenshotArtifact[],
  configuredRoot: string,
): Promise<void> {
  if (!artifacts.length) return;
  const resolvedRoot = path.resolve(configuredRoot);
  await fsp.mkdir(resolvedRoot, { recursive: true });
  const root = await fsp.realpath(resolvedRoot);
  for (const artifact of artifacts) {
    const target = path.resolve(resolvedRoot, artifact.path);
    const relative = path.relative(resolvedRoot, target);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("Screenshot artifact path must stay in the Browsie artifact directory.");
    }
    let directory = root;
    const components = relative.split(path.sep);
    for (const component of components.slice(0, -1)) {
      directory = path.join(directory, component);
      await fsp.mkdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      if (!(await fsp.lstat(directory)).isDirectory()) {
        throw new Error("Screenshot artifact directory must not be a symbolic link.");
      }
    }
    const file = await fsp.open(
      path.join(directory, components.at(-1)!),
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(Buffer.from(artifact.base64, "base64"));
    } finally {
      await file.close();
    }
  }
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/([?&](?:signingKey|apiKey|api_key|token|key)=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1[redacted]")
    .replace(/\b(bb_(?:live|test)_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, "$1[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{30,}/g, "AIza[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[redacted]");
}
