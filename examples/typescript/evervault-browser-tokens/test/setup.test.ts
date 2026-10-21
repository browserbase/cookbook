import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { saveCertificateId } from "../scripts/setup.js";

test("certificate setup saves only the ID to a private file and reuses its field", async () => {
  const directory = await mkdtemp(join(tmpdir(), "evervault-env-test-"));
  const path = join(directory, ".env");
  await saveCertificateId(path, "fixture-certificate-one");
  await saveCertificateId(path, "fixture-certificate-two");
  const contents = await readFile(path, "utf8");
  assert.equal(contents, "BROWSERBASE_CA_CERTIFICATE_ID=fixture-certificate-two\n");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  const link = join(directory, "link");
  await symlink(path, link);
  await assert.rejects(() => saveCertificateId(link, "fixture-certificate-three"));
  await assert.rejects(() => saveCertificateId(path, "fixture\nEXTRA=value"));
});
