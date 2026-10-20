import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["desktop/electron/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    ".output/**",
    ".eve/**",
    ".browsie/**",
    "desktop/dist/**",
    "desktop/release/**",
    "node_modules/**",
    "runs/**",
  ]),
]);
