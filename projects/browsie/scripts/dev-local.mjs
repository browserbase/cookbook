#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { browsieLaunchSpec, localServiceUrl } from "./linq-local.mjs";

const PORT = 4318;

export function localDevEnvironment(source, generatedSecret) {
  return {
    ...source,
    BROWSIE_PUBLIC_URL: source.BROWSIE_PUBLIC_URL ?? localServiceUrl(PORT),
    BROWSIE_HANDOFF_SECRET:
      source.BROWSIE_HANDOFF_SECRET ?? generatedSecret ?? randomBytes(32).toString("base64url"),
  };
}

function run() {
  const launch = browsieLaunchSpec(PORT);
  const child = spawn(launch.command, launch.args, {
    cwd: path.dirname(fileURLToPath(import.meta.url)) + "/..",
    detached: false,
    env: localDevEnvironment(process.env),
    stdio: "inherit",
  });
  child.once("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

function selfTest() {
  const generated = "generated-test-secret-with-at-least-32-bytes";
  const defaults = localDevEnvironment({}, generated);
  assert.equal(defaults.BROWSIE_PUBLIC_URL, "http://localhost:4318");
  assert.equal(defaults.BROWSIE_HANDOFF_SECRET, generated);
  const configured = localDevEnvironment(
    {
      BROWSIE_PUBLIC_URL: "https://browsie.example",
      BROWSIE_HANDOFF_SECRET: "configured-test-secret-with-at-least-32-bytes",
    },
    generated,
  );
  assert.equal(configured.BROWSIE_PUBLIC_URL, "https://browsie.example");
  assert.equal(configured.BROWSIE_HANDOFF_SECRET, "configured-test-secret-with-at-least-32-bytes");
  process.stdout.write("Local Browsie runner tests passed.\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  if (process.argv.includes("--self-test")) selfTest();
  else run();
}
