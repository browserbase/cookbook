import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  LoginInput,
  SafeLoginItem,
  SecretRef,
  VaultProvider,
  VaultProviderStatus,
} from "./types";
import { normalizeHosts } from "./types";

type Box = { iv: string; tag: string; ciphertext: string };
type Stored = {
  version: 1;
  id: string;
  label: string;
  allowedHosts: string[];
  hasTotp: boolean;
  createdAt: string;
  updatedAt: string;
  keyId: string;
  wrappedKey: Box;
  payload: Box;
};
type Payload = {
  username: string;
  password: string;
  totpSecret?: string;
  notes?: string;
};
interface VaultStore {
  read(): Promise<Stored[]>;
  write(records: Stored[]): Promise<void>;
}
export class AtomicFileVaultStore implements VaultStore {
  constructor(private path = process.env.BROWSIE_VAULT_FILE ?? ".browsie/vault.enc.json") {}
  async read() {
    try {
      const value = JSON.parse(await readFile(this.path, "utf8"));
      return Array.isArray(value?.records) ? value.records : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async write(records: Stored[]) {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify({ version: 1, records }));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, this.path);
  }
}
export class NativeVaultProvider implements VaultProvider {
  constructor(
    private store: VaultStore = new AtomicFileVaultStore(),
    private masterKey = readMasterKey(),
  ) {}
  async status(): Promise<VaultProviderStatus> {
    return {
      provider: "native",
      configured: Boolean(this.masterKey),
      healthy: Boolean(this.masterKey),
      mode: "local-encrypted",
      message: this.masterKey
        ? "Encrypted local demo Vault ready."
        : "Set BROWSIE_VAULT_MASTER_KEY to a 32-byte base64 or 64-character hex key.",
    };
  }
  async list() {
    return (await this.store.read()).map(toSafe);
  }
  async create(input: LoginInput) {
    requireInput(input);
    const now = new Date().toISOString(),
      record = this.encrypt(randomUUID(), input, now, now);
    const all = await this.store.read();
    await this.store.write([...all, record]);
    return toSafe(record);
  }
  async update(id: string, input: LoginInput) {
    requireInput(input);
    const all = await this.store.read(),
      index = all.findIndex((x) => x.id === id);
    if (index < 0) throw new Error("Vault item not found.");
    all[index] = this.encrypt(id, input, all[index].createdAt, new Date().toISOString());
    await this.store.write(all);
    return toSafe(all[index]);
  }
  async delete(id: string) {
    const all = await this.store.read(),
      next = all.filter((x) => x.id !== id);
    if (next.length === all.length) throw new Error("Vault item not found.");
    await this.store.write(next);
  }
  async resolve(ref: SecretRef) {
    if (ref.provider !== "native") throw new Error("Provider mismatch.");
    const record = (await this.store.read()).find((x) => x.id === ref.itemId);
    if (!record) throw new Error("Vault item not found.");
    const payload = this.decrypt(record);
    const value = ref.field === "totp" ? payload.totpSecret : payload[ref.field];
    if (!value) throw new Error("Vault field unavailable.");
    return value;
  }
  private encrypt(id: string, input: LoginInput, createdAt: string, updatedAt: string): Stored {
    const master = requireKey(this.masterKey),
      dataKey = randomBytes(32);
    return {
      version: 1,
      id,
      label: input.label.trim(),
      allowedHosts: normalizeHosts(input.allowedHosts),
      hasTotp: Boolean(input.totpSecret),
      createdAt,
      updatedAt,
      keyId: "local-v1",
      wrappedKey: seal(master, dataKey),
      payload: seal(
        dataKey,
        Buffer.from(
          JSON.stringify({
            username: input.username,
            password: input.password,
            ...(input.totpSecret ? { totpSecret: input.totpSecret } : {}),
            ...(input.notes ? { notes: input.notes } : {}),
          } satisfies Payload),
        ),
      ),
    };
  }
  private decrypt(record: Stored): Payload {
    const master = requireKey(this.masterKey),
      key = openBox(master, record.wrappedKey);
    return JSON.parse(openBox(key, record.payload).toString("utf8"));
  }
}
function seal(key: Buffer, value: Buffer): Box {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}
function openBox(key: Buffer, box: Box) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(box.ciphertext, "base64")), decipher.final()]);
}
function readMasterKey() {
  const value = process.env.BROWSIE_VAULT_MASTER_KEY?.trim();
  if (!value) return;
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  return key.length === 32 ? key : undefined;
}
function requireKey(key?: Buffer) {
  if (!key) throw new Error("Vault master key is not configured.");
  return key;
}
function requireInput(input: LoginInput) {
  if (
    !input.label.trim() ||
    !input.username ||
    !input.password ||
    normalizeHosts(input.allowedHosts).length === 0
  )
    throw new Error("Label, host, username, and password are required.");
}
function toSafe(record: Stored): SafeLoginItem {
  const fields = {
    username: true,
    password: true,
    totp: Boolean(record.hasTotp),
  };
  return {
    provider: "native",
    itemId: record.id,
    label: record.label,
    allowedHosts: record.allowedHosts,
    fields,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
