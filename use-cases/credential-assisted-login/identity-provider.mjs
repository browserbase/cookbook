/**
 * Local identity-provider simulation for synthetic credentials only.
 * POST /token signs caller-selected claims without authentication or policy.
 * GET /pubkey publishes the ephemeral signing key; GET /health reports liveness.
 * A valid signature here does not establish an authorized delegation.
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 8790);
const ISSUER = "urn:browserbase:cookbook:local-idp-simulation";

// Signing keypair — generated at startup. Private key never leaves this service.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" });

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function signJwt(claims) {
  const header = { alg: "RS256", typ: "JWT", kid: "sample_org-idp-1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${b64url(sig)}`;
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health")
    return send(res, 200, { ok: true });
  if (req.method === "GET" && req.url === "/pubkey")
    return send(res, 200, { iss: ISSUER, pem: PUBLIC_PEM });

  if (req.method === "POST" && req.url === "/token") {
    const b = await readBody(req);
    if (!b || !b.agentId || !b.host) {
      return send(res, 400, { error: "agentId and host required" });
    }
    const iat = Math.floor(Date.now() / 1000);
    const ttl = Math.min(Number(b.ttl) || 300, 900); // token lives 5 min by default
    const claims = {
      iss: ISSUER,
      sub: `agent:${b.agentId}`, // the agent identity
      on_behalf_of: b.onBehalfOf || "user:unknown",
      scope: [`vault:read:${b.host}`], // Caller-selected scope, not an authorization decision
      iat,
      exp: iat + ttl,
      jti: crypto.randomUUID(), // Unique ID; this simulation has no revocation service
    };
    return send(res, 200, { token: signJwt(claims), claims });
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(
    `[idp] trusted-local simulation on 127.0.0.1:${PORT}  (POST /token, GET /pubkey)\n`,
  );
});
