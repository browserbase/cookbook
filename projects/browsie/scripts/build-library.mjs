import { readdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const entries = {
  runtime: "agent/lib/browser-runtime.ts",
  "channels/linq": "agent/channels/linq.ts",
  handoff: "app/handoff/[token]/route.ts",
  "handoff-live": "app/handoff/[token]/live/route.ts",
};
for (const group of ["tools", "hooks"]) {
  for (const name of (await readdir(`agent/${group}`)).sort()) {
    if (name.endsWith(".ts")) entries[`${group}/${name.slice(0, -3)}`] = `agent/${group}/${name}`;
  }
}
await rm("dist/shared", { recursive: true, force: true });
await build({
  entryPoints: entries,
  outdir: "dist/shared",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node24",
  packages: "external",
});
