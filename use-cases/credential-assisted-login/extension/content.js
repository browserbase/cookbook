/**
 * Demo extension: generate a recipient keypair, publish its public key through
 * a cookie, unwrap a lease, check host/expiry, and fill the demonstration form.
 * The local vault decrypts server-side and accepts caller-supplied recipient
 * keys without browser attestation. This is a trusted-server simulation.
 */

let sessionKeyPair = null; // kept alive in module scope across poll ticks

function readCookie(name) {
  const e = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="));
  return e ? decodeURIComponent(e.split("=").slice(1).join("=")) : null;
}
function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function setInputValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  ).set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function publishSessionKey() {
  sessionKeyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    /* extractable */ false, // RSA public key remains exportable; private key cannot be exported
    ["decrypt"],
  );
  const spki = await crypto.subtle.exportKey("spki", sessionKeyPair.publicKey);
  writeCookie("__rpass_session_pubkey__", bytesToB64(spki));
  console.log(
    "[RPass] Generated ephemeral session keypair; published public key.",
  );
}

async function unwrapAndFill() {
  const wrappedB64 = readCookie("__rpass_wrapped_lease__");
  if (!wrappedB64 || !sessionKeyPair) return false;

  let lease;
  try {
    const env = JSON.parse(wrappedB64); // { wrappedKey, iv, ciphertext }
    // 1. Unwrap the one-time AES key with our private key
    const aesRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      sessionKeyPair.privateKey,
      b64ToBytes(env.wrappedKey),
    );
    // 2. AES-GCM decrypt the credential payload
    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const ptBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(env.iv) },
      aesKey,
      b64ToBytes(env.ciphertext),
    );
    lease = JSON.parse(new TextDecoder().decode(ptBuf));
  } catch (e) {
    console.log(
      "[RPass] Could not unwrap lease (not ours, or tampered):",
      e.message,
    );
    return false;
  }

  // Verify binding
  const now = Math.floor(Date.now() / 1000);
  if (lease.hostname !== location.hostname) {
    console.log(
      `[RPass] Lease bound to ${lease.hostname}, not ${location.hostname} — refusing`,
    );
    return true;
  }
  if (lease.exp && lease.exp < now) {
    console.log("[RPass] Lease expired — refusing");
    return true;
  }

  const u = document.querySelector(
    "#username, input[name='username'], input[type='email']",
  );
  const p = document.querySelector("input[type='password']");
  if (!u || !p) {
    console.log("[RPass] Login form not found");
    return true;
  }

  setInputValue(u, lease.username);
  setInputValue(p, lease.password);

  // Burn everything: the wrapped lease and our published public key
  deleteCookie("__rpass_wrapped_lease__");
  deleteCookie("__rpass_session_pubkey__");
  console.log(
    `[RPass] Unwrapped lease for agent=${lease.agentId}, filled form, burned lease.`,
  );
  return true;
}

async function main() {
  await publishSessionKey();
  // Poll for the wrapped lease the orchestration layer will inject
  let ticks = 0;
  const timer = setInterval(async () => {
    ticks++;
    const done = await unwrapAndFill();
    if (done || ticks > 40) clearInterval(timer); // stop after fill or ~12s
  }, 300);
}

setTimeout(main, 400);
