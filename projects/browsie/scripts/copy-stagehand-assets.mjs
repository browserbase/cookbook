import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagehandEntry = fileURLToPath(import.meta.resolve("@browserbasehq/stagehand"));
const sourceDist = path.dirname(stagehandEntry);
const targetDist = path.join(
  appRoot,
  ".output",
  "server",
  "node_modules",
  "@browserbasehq",
  "stagehand",
  "dist",
);

await mkdir(targetDist, { recursive: true });
for (const asset of ["assets", "extension"]) {
  await cp(path.join(sourceDist, asset), path.join(targetDist, asset), {
    force: true,
    recursive: true,
  });
}

process.stdout.write("Copied Stagehand runtime assets into the Eve build.\n");
