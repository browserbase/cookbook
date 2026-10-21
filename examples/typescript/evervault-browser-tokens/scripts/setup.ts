import { Browserbase, toFile } from "@browserbasehq/sdk";
import { X509Certificate, randomUUID } from "node:crypto";
import { chmod, lstat, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";

export async function saveCertificateId(path: string, id: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid certificate ID");
  const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (stat && !stat.isFile()) throw new Error("The environment path must be a regular file");
  const contents = stat ? await readFile(path, "utf8") : "";
  const line = `BROWSERBASE_CA_CERTIFICATE_ID=${id}`;
  const next = /^BROWSERBASE_CA_CERTIFICATE_ID=.*$/m.test(contents)
    ? contents.replace(/^BROWSERBASE_CA_CERTIFICATE_ID=.*$/gm, line)
    : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}${line}\n`;
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, next, { flag: "wx", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const client = new Browserbase({
    apiKey: config.browserbaseApiKey,
    timeout: 15_000,
    maxRetries: 0,
  });
  if (config.caCertificateId) {
    await client.certificates.retrieve(config.caCertificateId);
    console.info(
      "Existing certificate is accessible with this API key. Reusing it without an upload; verify it is the Evervault CA you intended to trust.",
    );
    return;
  }
  const response = await fetch("https://ca.evervault.com", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("CA download failed");
  const pem = await response.text();
  const certificate = new X509Certificate(pem);
  if (
    !certificate.ca ||
    Date.parse(certificate.validFrom) > Date.now() ||
    Date.parse(certificate.validTo) <= Date.now()
  ) {
    throw new Error("Invalid or expired CA");
  }
  const uploaded = await client.certificates.create({
    file: await toFile(Buffer.from(pem), "evervault-ca.pem", { type: "application/x-pem-file" }),
  });
  await saveCertificateId(resolve(".env"), uploaded.id);
  console.info("Evervault CA uploaded; certificate ID saved to the private .env (mode 0600).");
  console.info(`Public CA SHA-256 fingerprint: ${certificate.fingerprint256}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    console.error(
      "Certificate setup failed. Check credentials, certificate access, and the Evervault CA. No provider response is printed. A failed file write may still have created a certificate; inspect your project before retrying.",
    );
    process.exitCode = 1;
  });
}
