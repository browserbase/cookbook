import path from "node:path";
import { fileURLToPath } from "node:url";

import { withEve } from "eve/next";
import type { NextConfig } from "next";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  outputFileTracingRoot: appRoot,
  serverExternalPackages: ["@browserbasehq/stagehand"],
  turbopack: { root: appRoot },
};

export default withEve(nextConfig);
