import { isIP } from "node:net";

export function serverConfiguration(values: Record<string, string | undefined>) {
  const portText = values.PORT?.trim() || "3000";
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const port = Number(portText);
  const host = values.HOST?.trim() || "127.0.0.1";
  if (!isIP(host)) throw new Error("HOST must be an explicit IP address.");
  const origin = new URL(values.PORTAL_URL?.trim() || `http://${host === "::1" ? "[::1]" : "localhost"}:${port}`);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("PORTAL_URL must be an HTTP(S) origin without credentials or a path.");
  }
  if (!["127.0.0.1", "::1"].includes(host) && origin.protocol !== "https:") {
    throw new Error("Non-loopback hosting requires an explicit HTTPS PORTAL_URL and a protected deployment.");
  }
  return { port, host, origin: origin.origin };
}
