import "dotenv/config";

// Documented public fixtures, never personal card data.
export const TEST_CARD_NUMBER = "4242424242424242";
export const TEST_CARD_CVC = "123";
export const TEST_CARD_EXPIRY = { month: "12", year: "34" } as const;
export const CARD_CHECKOUT_PATH = "/mock-merchant/checkout";
export const CARD_AUTHORIZE_PATH = "/mock-merchant/authorize";

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
  if (!value || value.startsWith("<")) throw new Error(`Set ${name} in your private .env`);
  return value;
}

export function exactHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error(
      "CARD_TARGET_HOST must be an exact public hostname without a scheme, wildcard, port, or path",
    );
  }
  return hostname;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { requireCertificate?: boolean } = {},
): AppConfig {
  const port = Number(env.PORT ?? "4173");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535");
  return {
    evervaultTeamId: required("EVERVAULT_TEAM_ID", env),
    evervaultAppId: required("EVERVAULT_APP_ID", env),
    evervaultApiKey: required("EVERVAULT_API_KEY", env),
    browserbaseApiKey: required("BROWSERBASE_API_KEY", env),
    caCertificateId: options.requireCertificate
      ? required("BROWSERBASE_CA_CERTIFICATE_ID", env)
      : (env.BROWSERBASE_CA_CERTIFICATE_ID?.trim() ?? ""),
    cardTargetHost: exactHostname(required("CARD_TARGET_HOST", env)),
    port,
  };
}

export function publicConfig(config: AppConfig) {
  return {
    teamId: config.evervaultTeamId,
    appId: config.evervaultAppId,
    cardTargetHostname: config.cardTargetHost,
    cardExpiry: TEST_CARD_EXPIRY,
  };
}
