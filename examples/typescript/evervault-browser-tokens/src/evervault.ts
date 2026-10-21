import { exactHostname, type AppConfig } from "./config.js";
import { DemoError, isEvervaultCiphertext } from "./sanitize.js";

export type EncryptedCard = { number: string; cvc: string };
export type CardBrowserTokens = {
  numberToken: string;
  cvcToken: string;
  expiresAt: string;
  proxy: { hostname: string; port: number; username: string; password: string };
};

type RawTokens = {
  data?: Array<{ id?: string; value?: string }>;
  proxyConfiguration?: Partial<CardBrowserTokens["proxy"]>;
};

export function parseCardBrowserTokens(raw: RawTokens, expiresAt: string): CardBrowserTokens {
  const numberToken = raw?.data?.find((item) => item.id === "demo-card-number")?.value;
  const cvcToken = raw?.data?.find((item) => item.id === "demo-card-cvc")?.value;
  const proxy = raw?.proxyConfiguration;
  if (
    typeof numberToken !== "string" ||
    !/^\d{12,19}$/.test(numberToken) ||
    typeof cvcToken !== "string" ||
    !/^\d{3,4}$/.test(cvcToken) ||
    !proxy ||
    typeof proxy.hostname !== "string" ||
    !/^(?:[a-z0-9-]+\.)+evervault\.app$/.test(proxy.hostname) ||
    !Number.isInteger(proxy.port) ||
    proxy.port! < 1 ||
    proxy.port! > 65535 ||
    typeof proxy.username !== "string" ||
    !proxy.username ||
    typeof proxy.password !== "string" ||
    !proxy.password
  ) {
    throw new DemoError(
      "BROWSER_TOKEN_INVALID",
      "Evervault returned incomplete card tokens or proxy configuration",
    );
  }
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    throw new DemoError("BROWSER_TOKEN_EXPIRED", "The card tokens have expired");
  }
  return { numberToken, cvcToken, expiresAt, proxy: proxy as CardBrowserTokens["proxy"] };
}

export async function createCardBrowserTokens(
  config: AppConfig,
  encryptedCard: EncryptedCard,
  targetHostname: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<CardBrowserTokens> {
  if (!isEvervaultCiphertext(encryptedCard.number) || !isEvervaultCiphertext(encryptedCard.cvc)) {
    throw new DemoError(
      "ENCRYPTED_CARD_REQUIRED",
      "Valid Evervault encrypted card values are required",
    );
  }
  const target = exactHostname(targetHostname);
  if (target !== config.cardTargetHost)
    throw new DemoError("TARGET_MISMATCH", "The destination must match CARD_TARGET_HOST");
  const expiresAt = new Date(Date.now() + 300_000).toISOString();
  const response = await (options.fetch ?? fetch)("https://api.evervault.com/browser-tokens", {
    method: "POST",
    signal: AbortSignal.any([
      AbortSignal.timeout(15_000),
      ...(options.signal ? [options.signal] : []),
    ]),
    headers: {
      authorization: `Basic ${Buffer.from(`${config.evervaultAppId}:${config.evervaultApiKey}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: [
        { id: "demo-card-number", category: "card.number", value: encryptedCard.number },
        { id: "demo-card-cvc", category: "card.cvv", value: encryptedCard.cvc },
      ],
      permissions: [{ action: "decrypt", target }],
      ttl: 300,
    }),
  });
  // Never parse or expose an upstream error body.
  if (!response.ok)
    throw new DemoError(
      "EVERVAULT_REQUEST_FAILED",
      "Evervault rejected token creation. Check sandbox access and credentials.",
    );
  try {
    return parseCardBrowserTokens((await response.json()) as RawTokens, expiresAt);
  } catch (error) {
    if (error instanceof DemoError) throw error;
    throw new DemoError("BROWSER_TOKEN_INVALID", "Evervault returned an invalid token response");
  }
}
