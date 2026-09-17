/**
 * Local trusted-server credential-wrapping simulation.
 * The server holds the master key and decrypts credentials before wrapping.
 * JWT signatures and host scope are checked, but the demo IdP authenticates no
 * caller and the recipient public key is not attested to a browser/session.
 * POST /lease accepts a caller-supplied recipient key. GET /audit is unauthenticated.
 * Use synthetic credentials only; this is not a zero-knowledge vault.
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 8788);
const IDP_BASE = process.env.IDP_BASE ?? "http://127.0.0.1:8790";
const EXPECTED_ISS = "urn:browserbase:cookbook:local-idp-simulation";

const VAULT_MASTER_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hex",
);

// ── AES-256-GCM (WebCrypto-compatible) ───────────────────────────────────────
function seal(key, obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([
    c.update(Buffer.from(JSON.stringify(obj))),
    c.final(),
  ]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64");
}
function open(key, b64) {
  const b = Buffer.from(b64, "base64");
  const iv = b.subarray(0, 12),
    tag = b.subarray(b.length - 16),
    ct = b.subarray(12, b.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString());
}

// ── Vault: credentials encrypted at rest ─────────────────────────────────────
function enroll(agentId, hostname, username, password) {
  return {
    [agentId]: { [hostname]: seal(VAULT_MASTER_KEY, { username, password }) },
  };
}
const ENCRYPTED_VAULT = enroll(
  "cookbook_example-agent-tax-2026",
  "the-internet.herokuapp.com",
  "tomsmith",
  "SuperSecretPassword!",
);

const AUDIT = [];
const audit = (e) => AUDIT.push({ at: new Date().toISOString(), ...e });

// ── JWT verification against the IdP's published public key ───────────────────
let IDP_PUBLIC_KEY = null;
function fetchIdpPublicKey() {
  return new Promise((resolve, reject) => {
    http
      .get(`${IDP_BASE}/pubkey`, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(crypto.createPublicKey(JSON.parse(d).pem));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}
const b64urlToBuf = (s) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function verifyJwt(token) {
  if (!IDP_PUBLIC_KEY) IDP_PUBLIC_KEY = await fetchIdpPublicKey();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, s] = parts;
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${h}.${p}`),
    IDP_PUBLIC_KEY,
    b64urlToBuf(s),
  );
  if (!ok) throw new Error("bad signature");
  const claims = JSON.parse(b64urlToBuf(p).toString());
  if (claims.iss !== EXPECTED_ISS) throw new Error("wrong issuer");
  if (claims.exp < Math.floor(Date.now() / 1000))
    throw new Error("token expired");
  return claims;
}

// scope entries look like "vault:read:the-internet.herokuapp.com"
const scopeAllowsHost = (claims, host) =>
  (claims.scope || []).some((s) => s === `vault:read:${host}`);
const agentIdFromSub = (claims) => (claims.sub || "").replace(/^agent:/, "");

function wrapToSession(spkiB64, aesKey) {
  const pub = crypto.createPublicKey({
    key: Buffer.from(spkiB64, "base64"),
    format: "der",
    type: "spki",
  });
  return crypto
    .publicEncrypt(
      {
        key: pub,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey,
    )
    .toString("base64");
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
  if (req.method === "GET" && req.url === "/audit")
    return send(res, 200, { entries: AUDIT });

  if (req.method === "POST" && req.url === "/lease") {
    const token = (req.headers["authorization"] || "").replace(
      /^Bearer\s+/i,
      "",
    );
    const body = await readBody(req);

    // 1. Verify the JWT (signature + issuer + expiry)
    let claims;
    try {
      claims = await verifyJwt(token);
    } catch (e) {
      audit({
        event: "lease.denied",
        reason: `jwt:${e.message}`,
        hostname: body?.hostname,
      });
      return send(res, 401, { error: `token rejected: ${e.message}` });
    }

    if (!body || !body.hostname || !body.sessionPublicKey) {
      return send(res, 400, {
        error: "hostname and sessionPublicKey required",
      });
    }

    // 2. Scope check — the token must be scoped to this host
    if (!scopeAllowsHost(claims, body.hostname)) {
      audit({
        event: "lease.denied",
        reason: "out_of_scope",
        sub: claims.sub,
        hostname: body.hostname,
      });
      return send(res, 403, {
        error: `token scope does not permit ${body.hostname}`,
      });
    }

    const agentId = agentIdFromSub(claims);
    const sealedCred = ENCRYPTED_VAULT[agentId]?.[body.hostname];
    if (!sealedCred) {
      audit({
        event: "lease.denied",
        reason: "no_credential",
        sub: claims.sub,
        hostname: body.hostname,
      });
      return send(res, 404, {
        error: "no credential enrolled for that agent+host",
      });
    }

    // 3. Decrypt on the trusted server, wrap to the caller-supplied key
    const cred = open(VAULT_MASTER_KEY, sealedCred);
    const ttl = Math.min(Number(body.ttl) || 120, 600);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    const payload = JSON.stringify({
      username: cred.username,
      password: cred.password,
      agentId,
      hostname: body.hostname,
      exp,
    });
    const ct = Buffer.concat([
      cipher.update(Buffer.from(payload)),
      cipher.final(),
    ]);
    const ciphertext = Buffer.concat([ct, cipher.getAuthTag()]).toString(
      "base64",
    );

    let wrappedKey;
    try {
      wrappedKey = wrapToSession(body.sessionPublicKey, aesKey);
    } catch (e) {
      return send(res, 400, {
        error: "invalid sessionPublicKey: " + e.message,
      });
    }

    audit({
      event: "lease.issued",
      sub: claims.sub,
      onBehalfOf: claims.on_behalf_of,
      hostname: body.hostname,
      jti: claims.jti,
      exp,
      wrappedTo: "caller-supplied-public-key",
    });
    return send(res, 200, {
      wrappedKey,
      iv: iv.toString("base64"),
      ciphertext,
      exp,
    });
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(
    `[vault] trusted-local simulation on 127.0.0.1:${PORT} (JWT auth via ${IDP_BASE})\n`,
  );
});
