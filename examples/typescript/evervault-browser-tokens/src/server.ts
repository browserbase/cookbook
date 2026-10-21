import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { executeCardRun } from "./card-run.js";
import {
  TEST_CARD_CVC,
  TEST_CARD_EXPIRY,
  TEST_CARD_NUMBER,
  loadConfig,
  publicConfig,
  type AppConfig,
} from "./config.js";
import type { EncryptedCard } from "./evervault.js";
import { RunStore, type RunExecutor } from "./run-store.js";
import { DemoError, isEvervaultCiphertext, safeError } from "./sanitize.js";

export function merchantPage(outcome?: "approved" | "declined"): string {
  const content = outcome
    ? `<section id="authorization-result" data-outcome="${outcome}"><p class="tag ${outcome}">${outcome === "approved" ? "APPROVED" : "DECLINED AS EXPECTED"}</p><h1>${outcome === "approved" ? "Synthetic authorization approved" : "Card verification failed"}</h1><p>${outcome === "approved" ? "The destination received the documented test fixture." : "The destination did not receive the approved test fixture."}</p></section>`
    : `<form id="mock-checkout" method="post" action="/mock-merchant/authorize" autocomplete="off">
        <label>Card number<input id="card-number" name="number" inputmode="numeric" required></label>
        <div class="row"><label>Expiry<input id="card-expiry" name="expiry" value="12/34" required></label><label>CVC<input id="card-cvc" name="cvc" inputmode="numeric" required></label></div>
        <button type="submit">Authorize synthetic card</button>
      </form>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic merchant</title><link rel="stylesheet" href="/merchant.css"></head><body><main class="shell"><p class="eyebrow">Synthetic merchant · no purchase</p>${content}<p class="notice">Public fixtures only. A production integration reveals card data to a separately controlled merchant or PSP.</p></main></body></html>`;
}

export function createApp(
  options: {
    config?: AppConfig;
    executor?: (card: EncryptedCard) => RunExecutor;
  } = {},
) {
  const config = options.config ?? loadConfig(process.env, { requireCertificate: true });
  const runs = new RunStore();
  const app = express();
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  const localHost = `127.0.0.1:${config.port}`;
  const localOrigin = `http://${localHost}`;
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://js.evervault.com; connect-src 'self' https://*.evervault.com; frame-src https://*.browserbase.com https://ui-components.evervault.com; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
    );
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  // These are the only routes the HTTPS reverse proxy may expose.
  app.get("/mock-merchant/checkout", (_request, response) =>
    response.type("html").send(merchantPage()),
  );
  app.post(
    "/mock-merchant/authorize",
    (request, response, next) => {
      if (!request.is("application/x-www-form-urlencoded")) {
        response.status(415).send("Unsupported media type");
        return;
      }
      next();
    },
    express.urlencoded({ extended: false, limit: "1kb", parameterLimit: 3 }),
    (request, response) => {
      const digits = (value: unknown) =>
        typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
      const approved =
        digits(request.body?.number) === TEST_CARD_NUMBER &&
        digits(request.body?.cvc) === TEST_CARD_CVC &&
        request.body?.expiry === `${TEST_CARD_EXPIRY.month}/${TEST_CARD_EXPIRY.year}`;
      // Do not log, echo, persist, or redirect with any submitted value.
      response
        .status(approved ? 200 : 422)
        .type("html")
        .send(merchantPage(approved ? "approved" : "declined"));
    },
  );
  app.get("/merchant.css", (_request, response) =>
    response.sendFile(join(publicDir, "merchant.css")),
  );

  // Defense in depth: deny the presenter/API even if a proxy forwards other paths.
  // No forwarded header is trusted. The public proxy must preserve the public Host.
  app.use((request, response, next) => {
    const origin = request.get("origin");
    if (
      request.get("host") !== localHost ||
      (origin && origin !== localOrigin) ||
      (request.get("sec-fetch-site") &&
        !["same-origin", "none"].includes(request.get("sec-fetch-site")!))
    ) {
      response
        .status(403)
        .json({ error: { code: "LOCAL_ONLY", message: "Use the local presenter URL" } });
      return;
    }
    next();
  });
  app.use(
    "/api",
    (request, response, next) => {
      if (request.get("x-demo-request") !== "1") {
        response
          .status(403)
          .json({ error: { code: "LOCAL_ONLY", message: "Use the local presenter UI" } });
        return;
      }
      next();
    },
    express.json({ limit: "12kb" }),
  );

  app.get("/api/config", (_request, response) => response.json(publicConfig(config)));
  app.post("/api/card-runs", (request, response) => {
    const card = request.body?.encryptedCard;
    const expiry = request.body?.expiry;
    if (
      !isEvervaultCiphertext(card?.number) ||
      !isEvervaultCiphertext(card?.cvc) ||
      expiry?.month !== TEST_CARD_EXPIRY.month ||
      expiry?.year !== TEST_CARD_EXPIRY.year
    ) {
      response.status(400).json({
        error: {
          code: "ENCRYPTED_CARD_REQUIRED",
          message: "Complete the hosted test-card collection first",
        },
      });
      return;
    }
    try {
      const values: EncryptedCard = { number: card.number, cvc: card.cvc };
      const run = runs.start(
        options.executor?.(values) ?? ((context) => executeCardRun(config, values, context)),
      );
      response.status(202).json({ runId: run.runId });
    } catch (error) {
      response
        .status(error instanceof DemoError && error.code === "RUN_IN_PROGRESS" ? 409 : 500)
        .json({ error: safeError(error) });
    }
  });
  app.get("/api/runs/:runId", (request, response) => {
    const run = runs.get(request.params.runId);
    if (!run) {
      response.status(404).json({ error: { message: "Run not found" } });
      return;
    }
    response.json(run);
  });
  app.post("/api/runs/:runId/advance", (request, response) => {
    const action = request.body?.action;
    if (action !== "enter_token" && action !== "submit_token") {
      response.status(400).json({ error: { message: "Invalid checkpoint action" } });
      return;
    }
    try {
      const run = runs.advance(request.params.runId, action);
      if (!run) {
        response.status(404).json({ error: { message: "Run not found" } });
        return;
      }
      response.status(202).json({ runId: run.runId });
    } catch (error) {
      response.status(409).json({ error: safeError(error) });
    }
  });
  app.post("/api/runs/:runId/stop", async (request, response) => {
    const run = await runs.stop(request.params.runId);
    if (!run) {
      response.status(404).json({ error: { message: "Run not found" } });
      return;
    }
    response.status(202).json({ runId: run.runId });
  });
  app.use(express.static(publicDir, { index: "index.html", etag: false, dotfiles: "deny" }));
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      response.status(400).json({ error: safeError(error) });
    },
  );
  return { app, config, runs };
}

if (process.env.NODE_ENV !== "test") {
  try {
    const { app, config, runs } = createApp();
    const server = app.listen(config.port, "127.0.0.1", () => {
      console.info(`Local card demo: http://127.0.0.1:${config.port}`);
    });
    const shutdown = async () => {
      server.close();
      await runs.shutdown();
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  } catch {
    console.error(
      "Startup failed. Check the required variables in your private .env; provider details are not printed.",
    );
    process.exitCode = 1;
  }
}
