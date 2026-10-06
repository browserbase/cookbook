import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SafeLoginItem, SecretRef, VaultProvider, VaultProviderStatus } from "./types";

const execFileAsync = promisify(execFile);

type Backend = "sdk" | "cli";
type CliVault = { id?: unknown; name?: unknown; title?: unknown };
type CliField = {
  id?: unknown;
  label?: unknown;
  purpose?: unknown;
  type?: unknown;
  value?: unknown;
};
type CliUrl = { href?: unknown; url?: unknown };
type CliItem = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  fields?: unknown;
  urls?: unknown;
  websites?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
};

export class OnePasswordVaultProvider implements VaultProvider {
  private client?: Promise<import("@1password/sdk").Client>;
  private backend?: Backend;

  async status(): Promise<VaultProviderStatus> {
    const mode = authMode();
    if (mode === "unconfigured")
      return {
        provider: "onepassword",
        configured: false,
        healthy: false,
        mode,
        message:
          "Set OP_SERVICE_ACCOUNT_TOKEN for hosted use, or OP_ACCOUNT for optional local desktop authorization.",
      };
    try {
      const backend = await this.selectBackend();
      return {
        provider: "onepassword",
        configured: true,
        healthy: true,
        mode,
        message:
          backend === "cli"
            ? "Connected through the local 1Password CLI fallback."
            : mode === "service-account"
              ? "Connected with a server-side service account."
              : "Connected through the local 1Password desktop app.",
      };
    } catch {
      return {
        provider: "onepassword",
        configured: true,
        healthy: false,
        mode,
        message:
          "1Password authentication failed. Check the server configuration and vault permissions.",
      };
    }
  }

  async list(): Promise<SafeLoginItem[]> {
    const backend = await this.selectBackend();
    if (backend === "cli") return this.listWithCli();
    try {
      return await this.listWithSdk();
    } catch (error) {
      return this.useCliAfterSdkFailure(error, () => this.listWithCli());
    }
  }

  async resolve(ref: SecretRef): Promise<string> {
    if (ref.provider !== "onepassword" || !ref.vaultId)
      throw new Error("Invalid 1Password reference.");
    const backend = await this.selectBackend();
    if (backend === "cli") return this.resolveWithCli(ref);
    try {
      return await this.resolveWithSdk(ref);
    } catch (error) {
      return this.useCliAfterSdkFailure(error, () => this.resolveWithCli(ref));
    }
  }

  private async selectBackend(): Promise<Backend> {
    if (this.backend) return this.backend;
    try {
      const client = await this.getClient();
      await client.vaults.list({ decryptDetails: true });
      this.backend = "sdk";
    } catch (sdkError) {
      try {
        await runOp(["vault", "list", "--format=json"]);
        this.backend = "cli";
      } catch {
        throw sdkError;
      }
    }
    return this.backend;
  }

  private async useCliAfterSdkFailure<T>(
    sdkError: unknown,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await operation();
      this.backend = "cli";
      return result;
    } catch {
      throw sdkError;
    }
  }

  private async listWithSdk(): Promise<SafeLoginItem[]> {
    const sdk = await import("@1password/sdk"),
      client = await this.getClient(),
      vaults = await client.vaults.list({ decryptDetails: true }),
      items: SafeLoginItem[] = [];
    for (const vault of vaults) {
      for (const overview of await client.items.list(vault.id)) {
        if (overview.category !== sdk.ItemCategory.Login) continue;
        const item = await client.items.get(vault.id, overview.id),
          has = (id: string) => item.fields.some((field) => field.id === id),
          hasTotp = item.fields.some((field) => field.fieldType === sdk.ItemFieldType.Totp);
        items.push({
          provider: "onepassword",
          vaultId: vault.id,
          vaultName: vault.title,
          itemId: item.id,
          label: item.title,
          allowedHosts: item.websites.map((site) => host(site.url)).filter(Boolean),
          fields: {
            username: has("username"),
            password: has("password"),
            totp: hasTotp,
          },
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        });
      }
    }
    return items;
  }

  private async resolveWithSdk(ref: SecretRef): Promise<string> {
    const sdk = await import("@1password/sdk"),
      item = await (await this.getClient()).items.get(ref.vaultId!, ref.itemId);
    if (ref.field === "totp") {
      const field = item.fields.find((candidate) => candidate.fieldType === sdk.ItemFieldType.Totp),
        code = field?.details?.type === "Otp" ? field.details.content.code : undefined;
      if (!code) throw new Error("The Login item has no valid TOTP code.");
      return code;
    }
    const field = item.fields.find((candidate) => candidate.id === ref.field);
    if (!field?.value) throw new Error(`The Login item has no ${ref.field} field.`);
    return field.value;
  }

  private async listWithCli(): Promise<SafeLoginItem[]> {
    const vaults = parseJsonArray<CliVault>(await runOp(["vault", "list", "--format=json"])),
      items: SafeLoginItem[] = [];
    for (const vault of vaults) {
      const vaultId = text(vault.id);
      if (!vaultId) continue;
      const overviews = parseJsonArray<CliItem>(
        await runOp(["item", "list", "--vault", vaultId, "--categories", "Login", "--format=json"]),
      );
      for (const overview of overviews) {
        const itemId = text(overview.id);
        if (!itemId) continue;
        const item = parseJson<CliItem>(
          await runOp(["item", "get", itemId, "--vault", vaultId, "--format=json"]),
        );
        const safe = toSafeCliItem(vault, item);
        if (safe) items.push(safe);
      }
    }
    return items;
  }

  private async resolveWithCli(ref: SecretRef): Promise<string> {
    const fieldName = ref.field;
    if (fieldName === "totp") {
      const code = (
        await runOp(["item", "get", ref.itemId, "--vault", ref.vaultId!, "--otp"])
      ).trim();
      if (!code) throw new Error("The Login item has no valid TOTP code.");
      return code;
    }
    const item = parseJson<CliItem>(
        await runOp(["item", "get", ref.itemId, "--vault", ref.vaultId!, "--format=json"]),
      ),
      field = fields(item).find((candidate) => isField(candidate, fieldName)),
      value = text(field?.value);
    if (!value) throw new Error(`The Login item has no ${fieldName} field.`);
    return value;
  }

  private getClient() {
    if (!this.client) {
      const token = process.env.OP_SERVICE_ACCOUNT_TOKEN,
        account = process.env.OP_ACCOUNT;
      if (!token && !account) throw new Error("1Password is not configured.");
      this.client = (async () => {
        const sdk = await import("@1password/sdk");
        return sdk.createClient({
          auth: token || new sdk.DesktopAuth(account!),
          integrationName: "Browsie",
          integrationVersion: "0.1.0",
        });
      })();
    }
    return this.client;
  }
}

export function toSafeCliItem(vault: CliVault, item: CliItem): SafeLoginItem | undefined {
  const vaultId = text(vault.id),
    itemId = text(item.id),
    itemFields = fields(item);
  if (!vaultId || !itemId) return undefined;
  return {
    provider: "onepassword",
    vaultId,
    vaultName: text(vault.name) || text(vault.title),
    itemId,
    label: text(item.title) || "1Password Login",
    allowedHosts: urls(item)
      .map((site) => host(text(site.href) || text(site.url)))
      .filter(Boolean),
    fields: {
      username: itemFields.some((field) => isField(field, "username")),
      password: itemFields.some((field) => isField(field, "password")),
      totp: itemFields.some(isTotpField),
    },
    createdAt: text(item.created_at) || text(item.createdAt) || undefined,
    updatedAt: text(item.updated_at) || text(item.updatedAt) || undefined,
  };
}

async function runOp(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("op", args, {
      env: process.env,
      timeout: 20_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      throw new Error("The 1Password CLI is not installed.");
    throw new Error("The 1Password CLI request failed.");
  }
}

function fields(item: CliItem): CliField[] {
  return Array.isArray(item.fields) ? (item.fields as CliField[]) : [];
}
function urls(item: CliItem): CliUrl[] {
  if (Array.isArray(item.urls)) return item.urls as CliUrl[];
  if (Array.isArray(item.websites)) return item.websites as CliUrl[];
  return [];
}
function isField(field: CliField, wanted: "username" | "password"): boolean {
  const id = text(field.id).toLowerCase(),
    purpose = text(field.purpose).toLowerCase();
  return id === wanted || purpose === wanted;
}
function isTotpField(field: CliField): boolean {
  const id = text(field.id).toLowerCase(),
    label = text(field.label).toLowerCase(),
    type = text(field.type).toLowerCase(),
    purpose = text(field.purpose).toLowerCase();
  return (
    type === "otp" ||
    purpose === "otp" ||
    id.includes("totp") ||
    label.includes("one-time password") ||
    label.includes("totp")
  );
}
function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
function parseJsonArray<T>(value: string): T[] {
  const parsed = parseJson<unknown>(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function authMode(): VaultProviderStatus["mode"] {
  return process.env.OP_SERVICE_ACCOUNT_TOKEN
    ? "service-account"
    : process.env.OP_ACCOUNT
      ? "desktop"
      : "unconfigured";
}
function host(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}
