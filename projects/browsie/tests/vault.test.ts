import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AtomicFileVaultStore, NativeVaultProvider } from "../server/vault/native";
import { generateTotp } from "../server/vault/totp";

async function fixture(key = Buffer.alloc(32, 7)) {
  const dir = await mkdtemp(join(tmpdir(), "browsie-vault-")),
    path = join(dir, "vault.json");
  return {
    path,
    vault: new NativeVaultProvider(new AtomicFileVaultStore(path), key),
  };
}
const login = {
  label: "Demo",
  allowedHosts: ["authenticationtest.com"],
  username: "fixture-user",
  password: "fixture-password",
  totpSecret: "JBSWY3DPEHPK3PXP",
  notes: "safe note",
};
describe("Native Vault", () => {
  it("encrypts each login at rest and exposes safe metadata only", async () => {
    const { path, vault } = await fixture();
    const item = await vault.create(login);
    expect(item.fields).toEqual({ username: true, password: true, totp: true });
    const raw = await readFile(path, "utf8");
    expect(raw).not.toContain(login.username);
    expect(raw).not.toContain(login.password);
    expect(raw).not.toContain(login.totpSecret);
    expect(
      await vault.resolve({
        provider: "native",
        itemId: item.itemId,
        field: "password",
      }),
    ).toBe(login.password);
  });
  it("rejects a wrong master key", async () => {
    const { path, vault } = await fixture();
    const item = await vault.create(login);
    const wrong = new NativeVaultProvider(new AtomicFileVaultStore(path), Buffer.alloc(32, 9));
    await expect(
      wrong.resolve({
        provider: "native",
        itemId: item.itemId,
        field: "password",
      }),
    ).rejects.toThrow();
  });
  it("detects ciphertext tampering", async () => {
    const { path, vault } = await fixture();
    const item = await vault.create(login);
    const data = JSON.parse(await readFile(path, "utf8"));
    data.records[0].payload.ciphertext =
      (data.records[0].payload.ciphertext.startsWith("A") ? "B" : "A") +
      data.records[0].payload.ciphertext.slice(1);
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(path, JSON.stringify(data), { mode: 0o600 }),
    );
    await expect(
      vault.resolve({
        provider: "native",
        itemId: item.itemId,
        field: "password",
      }),
    ).rejects.toThrow();
  });
  it("generates RFC 6238-compatible codes", () => {
    expect(generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000, 30, 8)).toBe("94287082");
  });
});
