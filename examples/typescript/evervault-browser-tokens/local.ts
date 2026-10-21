import express from "express";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { isEvervaultCiphertext, type AppConfig, type EncryptedCard } from "./evervault.js";

export function merchantPage(approved?: boolean): string {
  const content =
    approved === undefined
      ? `<h1>Synthetic card checkout</h1><p>No purchase or charge occurs. Public Visa fixture only.</p>
       <form id="mock-checkout" method="post" action="/mock-merchant/authorize" autocomplete="off">
       <label>Card number <input id="card-number" name="number" required></label>
       <label>Expiry <input id="card-expiry" name="expiry" required></label>
       <label>CVC <input id="card-cvc" name="cvc" required></label>
       <button type="submit">Authorize synthetic card</button></form>`
      : `<h1 id="authorization-result" data-outcome="${approved ? "approved" : "declined"}">${approved ? "Synthetic approval" : "Declined"}</h1>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic merchant</title><body>${content}</body></html>`;
}
export function createFixture(config: AppConfig, signal: AbortSignal) {
  let accepted = false;
  let receive!: (card: EncryptedCard) => void;
  const card = new Promise<EncryptedCard>((resolve) => {
    receive = resolve;
  });
  const app = express();
  const host = `127.0.0.1:${config.port}`;
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' https://js.evervault.com; connect-src 'self' https://*.evervault.com; frame-src https://ui-components.evervault.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    });
    next();
  });
  // Only these two routes may be forwarded by the reader's HTTPS proxy.
  app.get("/mock-merchant/checkout", (_request, response) =>
    response.type("html").send(merchantPage()),
  );
  app.post(
    "/mock-merchant/authorize",
    (request, response, next) => {
      if (!request.is("application/x-www-form-urlencoded")) {
        return response.sendStatus(415);
      }
      next();
    },
    express.urlencoded({ extended: false, limit: "1kb", parameterLimit: 3 }),
    (request, response) => {
      const approved =
        request.body?.number === "4242424242424242" &&
        request.body?.cvc === "123" &&
        request.body?.expiry === "12/34";
      response
        .status(approved ? 200 : 422)
        .type("html")
        .send(merchantPage(approved));
    },
  );
  app.use((request, response, next) => {
    if (
      request.get("host") !== host ||
      (request.get("origin") && request.get("origin") !== `http://${host}`) ||
      (request.get("sec-fetch-site") &&
        !["same-origin", "none"].includes(request.get("sec-fetch-site")!))
    ) {
      return response.sendStatus(403);
    }
    next();
  });
  app.use(
    "/api",
    (request, response, next) => {
      if (request.get("x-demo-request") !== "1") {
        return response.sendStatus(403);
      }
      next();
    },
    express.json({ limit: "12kb" }),
  );
  app.get("/api/config", (_request, response) =>
    response.json({ teamId: config.evervaultTeamId, appId: config.evervaultAppId }),
  );
  app.post("/api/collect", (request, response) => {
    if (accepted || signal.aborted) return response.sendStatus(409);
    const values = request.body;
    if (
      !isEvervaultCiphertext(values?.number) ||
      !isEvervaultCiphertext(values?.cvc) ||
      Object.keys(values).length !== 2
    )
      return response.sendStatus(400);
    accepted = true;
    response.status(202).json({ received: true });
    receive({ number: values.number, cvc: values.cvc });
  });
  app.use(
    express.static(fileURLToPath(new URL("./public", import.meta.url)), {
      etag: false,
      dotfiles: "deny",
    }),
  );
  const invalidRequest: express.ErrorRequestHandler = (_error, _request, response, _next) => {
    response.sendStatus(400);
  };
  app.use(invalidRequest);
  return { app, card };
}
export async function startFixture(config: AppConfig, signal: AbortSignal) {
  const fixture = createFixture(config, signal);
  const server = fixture.app.listen(config.port, "127.0.0.1");
  await once(server, "listening");
  const card = signal.aborted
    ? Promise.reject(signal.reason)
    : Promise.race([
        fixture.card,
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
      ]);
  return {
    card,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
