#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PORT = 4318;
const LOCAL_URL = localServiceUrl(PORT);
const LINQ_FORWARD_URL = `${LOCAL_URL}/eve/v1/linq`;
const LINQ_EVENTS = "message.received,reaction.added,reaction.removed";
const STARTUP_TIMEOUT_MS = 45_000;
const MAX_CAPTURE_BYTES = 256 * 1024;
// ANSI escape sequences contain one required control character.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const require = createRequire(import.meta.url);

export function localServiceUrl(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("A valid local service port is required.");
  }
  return `http://localhost:${port}`;
}

export function browsieLaunchSpec(port = PORT) {
  localServiceUrl(port);
  return {
    command: process.execPath,
    args: [require.resolve("next/dist/bin/next"), "dev", "-p", String(port)],
  };
}

function hasUnsafeSecretCharacter(value) {
  return (
    /\s/u.test(value) ||
    [...value].some((character) => {
      const code = character.codePointAt(0);
      return code !== undefined && (code < 32 || code === 127);
    })
  );
}

export function parseStoredLinqToken(output) {
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error(
      "The output from `linq tokens show --json` was not valid JSON. Update the official Linq CLI, run `linq login`, and try again.",
    );
  }

  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.keys(value).length !== 1 ||
    typeof value.token !== "string" ||
    value.token.length < 20 ||
    hasUnsafeSecretCharacter(value.token)
  ) {
    throw new Error(
      "The output shape from `linq tokens show --json` is not supported. Update the official Linq CLI, run `linq login`, and try again.",
    );
  }

  return value.token;
}

export function extractLinqSigningSecret(line) {
  const clean = line.replace(ANSI_PATTERN, "");
  const match = clean.match(/Signing secret:\s*([^\s]+)/i);
  if (!match) return null;

  const secret = match[1];
  if (secret.length < 32 || hasUnsafeSecretCharacter(secret)) return null;
  return secret;
}

export function extractCloudflareUrl(line) {
  const clean = line.replace(ANSI_PATTERN, "");
  return clean.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i)?.[0] ?? null;
}

function readStoredLinqToken() {
  const result = spawnSync("linq", ["tokens", "show", "--json"], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    maxBuffer: MAX_CAPTURE_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "The official Linq CLI is not installed. Install `@linqapp/cli`, run `linq login`, and try again.",
    );
  }
  if (result.error || result.status !== 0) {
    throw new Error(
      "The Linq CLI could not read an authenticated token. Run `linq login`, confirm with `linq whoami`, and try again.",
    );
  }

  return parseStoredLinqToken(result.stdout);
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Stop the existing Browsie process and try again.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(port, "localhost", () => server.close(resolve));
  });
}

function startChild(command, args, options = {}) {
  return spawn(command, args, {
    cwd: options.cwd,
    // Keep every child in the caller's foreground process group. Terminal
    // Ctrl-C then reaches all children even if pnpm stops this runner first.
    detached: false,
    env: options.env ?? process.env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function waitForCapturedValue(child, extractor, description) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let capturedBytes = 0;
    const buffers = new Map();

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(message));
    };

    const inspect = (stream, chunk) => {
      capturedBytes += chunk.length;
      if (capturedBytes > MAX_CAPTURE_BYTES) {
        fail(
          `Too much output arrived before ${description}. The process was stopped without printing its output.`,
        );
        return;
      }

      const current = `${buffers.get(stream) ?? ""}${chunk.toString("utf8")}`;
      const lines = current.split(/\r?\n/u);
      buffers.set(stream, lines.pop() ?? "");
      for (const line of lines) {
        const value = extractor(line);
        if (value) {
          finish(value);
          return;
        }
      }
    };

    for (const stream of [child.stdout, child.stderr]) {
      if (stream) stream.on("data", (chunk) => inspect(stream, chunk));
    }

    child.once("error", (error) => {
      if (error.code === "ENOENT") fail(`The command for ${description} is not installed.`);
      else fail(`The process for ${description} could not start.`);
    });
    child.once("exit", (code) => {
      fail(`The process stopped before ${description} was available (exit ${code ?? "unknown"}).`);
    });

    const timeout = setTimeout(() => {
      fail(
        `Timed out while waiting for ${description}. No captured output was printed. Check the CLI authentication and network, then try again.`,
      );
    }, STARTUP_TIMEOUT_MS);
  });
}

function signalChild(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    // Signal only this child PID. Next owns Eve and closes it on shutdown.
    // Never signal the shared foreground process group from this runner.
    child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function run() {
  await assertPortAvailable(PORT);
  const linqApiKey = readStoredLinqToken();
  const children = [];
  let shuttingDown = false;

  const stopAll = async (exitCode) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) signalChild(child, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    for (const child of children) signalChild(child, "SIGKILL");
    process.exit(exitCode);
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => void stopAll(0));
  }

  try {
    const linq = startChild("linq", [
      "webhooks",
      "listen",
      "--events",
      LINQ_EVENTS,
      "--forward-to",
      LINQ_FORWARD_URL,
    ]);
    children.push(linq);

    const tunnel = startChild("cloudflared", ["tunnel", "--url", LOCAL_URL, "--no-autoupdate"]);
    children.push(tunnel);

    const [linqWebhookSecret, publicUrl] = await Promise.all([
      waitForCapturedValue(linq, extractLinqSigningSecret, "the temporary Linq signing secret"),
      waitForCapturedValue(tunnel, extractCloudflareUrl, "the Cloudflare tunnel URL"),
    ]);

    const handoffSecret = randomBytes(32).toString("base64url");
    process.stdout.write("Linq webhook listener is ready.\n");
    process.stdout.write(`Browsie public URL: ${publicUrl}\n`);
    process.stdout.write(`Starting Browsie at ${LOCAL_URL}. Press Ctrl-C to stop all processes.\n`);

    const launch = browsieLaunchSpec();
    const browsie = startChild(launch.command, launch.args, {
      cwd: path.dirname(fileURLToPath(import.meta.url)) + "/..",
      env: {
        ...process.env,
        LINQ_API_KEY: linqApiKey,
        LINQ_WEBHOOK_SECRET: linqWebhookSecret,
        BROWSIE_PUBLIC_URL: publicUrl,
        BROWSIE_HANDOFF_SECRET: handoffSecret,
      },
      stdio: "inherit",
    });
    children.push(browsie);

    browsie.once("error", () => void stopAll(1));
    browsie.once("exit", (code, signal) => {
      if (shuttingDown) return;
      if (signal) process.stderr.write(`Browsie stopped after signal ${signal}.\n`);
      else process.stderr.write(`Browsie stopped with exit ${code ?? "unknown"}.\n`);
      void stopAll(code ?? 1);
    });

    for (const [child, name] of [
      [linq, "Linq webhook listener"],
      [tunnel, "Cloudflare tunnel"],
    ]) {
      child.once("exit", (code) => {
        if (shuttingDown) return;
        process.stderr.write(`${name} stopped with exit ${code ?? "unknown"}.\n`);
        void stopAll(code ?? 1);
      });
    }
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "The local Linq runner failed."}\n`,
    );
    await stopAll(1);
  }
}

function selfTest() {
  const signingSecretFixture = ["wh", "sec_", "abcdefghijklmnopqrstuvwxyz", "123456"].join("");
  const tokenFixture = ["linq", "_test_", "12345678901234567890"].join("");
  assert.equal(localServiceUrl(4318), "http://localhost:4318");
  assert.throws(() => localServiceUrl(0));
  const launch = browsieLaunchSpec(4318);
  assert.equal(launch.command, process.execPath);
  assert.deepEqual(launch.args.slice(1), ["dev", "-p", "4318"]);
  assert.match(launch.args[0], /[/\\]next[/\\]dist[/\\]bin[/\\]next$/u);
  assert.equal(parseStoredLinqToken(JSON.stringify({ token: tokenFixture })), tokenFixture);
  assert.throws(() => parseStoredLinqToken('{"token":"short"}'));
  assert.throws(() => parseStoredLinqToken(JSON.stringify({ token: tokenFixture, extra: true })));
  assert.equal(
    extractLinqSigningSecret(`Signing secret: ${signingSecretFixture} (this session only)`),
    signingSecretFixture,
  );
  assert.equal(extractLinqSigningSecret("Webhook created: wh_123"), null);
  assert.equal(
    extractCloudflareUrl(
      "INF Your quick Tunnel has been created! Visit it at https://safe-name.trycloudflare.com",
    ),
    "https://safe-name.trycloudflare.com",
  );
  process.stdout.write("Local Linq runner parser tests passed.\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  if (process.argv.includes("--self-test")) selfTest();
  else
    void run().catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "The local Linq runner failed."}\n`,
      );
      process.exit(1);
    });
}
