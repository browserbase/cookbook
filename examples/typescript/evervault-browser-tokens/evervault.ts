import "dotenv/config";

export type AppConfig = {
  evervaultTeamId: string;
  evervaultAppId: string;
  evervaultApiKey: string;
  browserbaseApiKey: string;
  caCertificateId: string;
  cardTargetHost: string;
  port: number;
};

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value || value.startsWith("<")) throw new RecipeError(`Set ${name} in your private .env`);
  return value;
}

export function exactHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new RecipeError(
      "CARD_TARGET_HOST must be an exact public hostname without a scheme, wildcard, port, or path",
    );
  }
  return hostname;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  requireCertificate = false,
): AppConfig {
  const port = Number(env.PORT ?? "4173");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new RecipeError("PORT must be an integer between 1 and 65535");
  return {
    evervaultTeamId: required("EVERVAULT_TEAM_ID", env),
    evervaultAppId: required("EVERVAULT_APP_ID", env),
    evervaultApiKey: required("EVERVAULT_API_KEY", env),
    browserbaseApiKey: required("BROWSERBASE_API_KEY", env),
    caCertificateId: requireCertificate
      ? required("BROWSERBASE_CA_CERTIFICATE_ID", env)
      : (env.BROWSERBASE_CA_CERTIFICATE_ID?.trim() ?? ""),
    cardTargetHost: exactHostname(required("CARD_TARGET_HOST", env)),
    port,
  };
}

export class RecipeError extends Error {}
export function safeMessage(error: unknown): string {
  return error instanceof RecipeError
    ? error.message
    : "Operation failed. Check configuration and provider access; private details are suppressed.";
}
export function isEvervaultCiphertext(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4096 && /^ev:\S{20,}$/.test(value);
}

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
    typeof proxy?.hostname !== "string" ||
    !/^(?:[a-z0-9-]+\.)+evervault\.app$/.test(proxy.hostname) ||
    !Number.isInteger(proxy.port) ||
    proxy.port! < 1 ||
    proxy.port! > 65535 ||
    typeof proxy.username !== "string" ||
    !proxy.username ||
    typeof proxy.password !== "string" ||
    !proxy.password
  ) {
    throw new RecipeError("Evervault returned incomplete card tokens or proxy configuration");
  }
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    throw new RecipeError("The card tokens have expired");
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
    throw new RecipeError("Valid Evervault encrypted card values are required");
  }
  const target = exactHostname(targetHostname);
  if (target !== config.cardTargetHost)
    throw new RecipeError("The destination must match CARD_TARGET_HOST");
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
    throw new RecipeError(
      "Evervault rejected token creation. Check sandbox access and credentials.",
    );
  try {
    return parseCardBrowserTokens((await response.json()) as RawTokens, expiresAt);
  } catch (error) {
    if (error instanceof RecipeError) throw error;
    throw new RecipeError("Evervault returned an invalid token response");
  }
}
