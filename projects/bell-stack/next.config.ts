import { withEve } from "eve/next";
import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["@browserbasehq/sdk", "@browserbasehq/stagehand"],
  transpilePackages: ["browsie"],
  turbopack: { root: process.cwd() },
};
export default withEve(config);
