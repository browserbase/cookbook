export type VaultProviderId = "native" | "onepassword";
export type LoginField = "username" | "password" | "totp";
export interface SecretRef {
  provider: VaultProviderId;
  itemId: string;
  field: LoginField;
  vaultId?: string;
}
export interface VaultProviderStatus {
  provider: VaultProviderId;
  configured: boolean;
  healthy: boolean;
  mode: "local-encrypted" | "service-account" | "desktop" | "unconfigured";
  message: string;
}
export interface SafeLoginItem {
  provider: VaultProviderId;
  itemId: string;
  vaultId?: string;
  vaultName?: string;
  label: string;
  allowedHosts: string[];
  fields: { username: boolean; password: boolean; totp: boolean };
  createdAt?: string;
  updatedAt?: string;
}
export interface LoginInput {
  label: string;
  allowedHosts: string[];
  username: string;
  password: string;
  totpSecret?: string;
  notes?: string;
}
export interface VaultProvider {
  status(): Promise<VaultProviderStatus>;
  list(): Promise<SafeLoginItem[]>;
  resolve(ref: SecretRef): Promise<string>;
  create?(input: LoginInput): Promise<SafeLoginItem>;
  update?(itemId: string, input: LoginInput): Promise<SafeLoginItem>;
  delete?(itemId: string): Promise<void>;
}
export function normalizeHosts(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => {
          const clean = value.trim().toLowerCase();
          if (!clean) return "";
          try {
            return new URL(clean.includes("://") ? clean : `https://${clean}`).hostname;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ];
}
export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Vault operation failed.";
  return /auth|token|secret|password|key/i.test(message)
    ? "Vault authentication or decryption failed."
    : message.slice(0, 240);
}
