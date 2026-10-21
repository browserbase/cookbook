import { Browserbase, toFile } from "@browserbasehq/sdk";
import { X509Certificate } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../evervault.js";

export async function setup(
  config = loadConfig(),
  client?: Browserbase,
  fetcher = fetch,
): Promise<string> {
  client ??= new Browserbase({ apiKey: config.browserbaseApiKey, timeout: 15_000, maxRetries: 0 });
  if (config.caCertificateId) {
    try {
      await client.certificates.retrieve(config.caCertificateId);
      return config.caCertificateId;
    } catch {
      /* An inaccessible ID requires a fresh upload. */
    }
  }
  const response = await fetcher("https://ca.evervault.com", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("CA download failed");
  const pem = await response.text();
  const certificate = new X509Certificate(pem);
  if (
    !certificate.ca ||
    Date.parse(certificate.validFrom) > Date.now() ||
    Date.parse(certificate.validTo) <= Date.now()
  )
    throw new Error("Invalid CA");
  const uploaded = await client.certificates.create({
    file: await toFile(Buffer.from(pem), "evervault-ca.pem", { type: "application/x-pem-file" }),
  });
  if (!/^[a-zA-Z0-9_-]+$/.test(uploaded.id)) throw new Error("Invalid certificate ID");
  return uploaded.id;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void setup()
    .then((id) => {
      console.info("Copy into .env; verify any reused certificate is the intended Evervault CA:");
      console.info(`BROWSERBASE_CA_CERTIFICATE_ID=${id}`);
    })
    .catch(() => {
      console.error("CA setup failed. Check Browserbase for a possible upload before retrying.");
      process.exitCode = 1;
    });
}
