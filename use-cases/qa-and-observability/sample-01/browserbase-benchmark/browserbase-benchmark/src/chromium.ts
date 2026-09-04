import { execSync } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";

const CANDIDATES: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ],
};

function which(bin: string): string | null {
  try {
    return execSync(`which ${bin}`, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export async function resolveChromiumPath(): Promise<string> {
  // 1. Explicit env override
  if (process.env.LOCAL_CHROMIUM_EXECUTABLE) {
    const p = process.env.LOCAL_CHROMIUM_EXECUTABLE;
    if (!existsSync(p)) {
      throw new Error(
        `LOCAL_CHROMIUM_EXECUTABLE set to "${p}" but the file does not exist.`
      );
    }
    return p;
  }

  // 2. Platform-specific well-known paths
  const os = platform();
  for (const candidate of CANDIDATES[os] ?? []) {
    if (existsSync(candidate)) return candidate;
  }

  // 3. PATH lookup
  for (const bin of ["google-chrome", "chromium-browser", "chromium"]) {
    const found = which(bin);
    if (found) return found;
  }

  // 4. Playwright's bundled Chromium (installed via npx playwright install chromium).
  //    Respects PLAYWRIGHT_BROWSERS_PATH if set.
  try {
    const { chromium } = await import("playwright-core");
    const executablePath = chromium.executablePath();
    console.log(`[chromium] playwright-core executablePath: ${executablePath}`);
    if (existsSync(executablePath)) return executablePath;
    console.log(`[chromium] not found at playwright-core path`);
  } catch (e) {
    console.log(`[chromium] playwright-core import failed: ${e}`);
  }

  // 5. Playwright headless shell (Playwright v1.48+ downloads this separately).
  //    Search multiple known cache locations for either the full chrome binary
  //    or the headless shell (covers Render, EC2, local macOS/Linux).
  const cacheDirs = [
    process.env.PLAYWRIGHT_BROWSERS_PATH ?? "",  // explicit override (e.g. /opt/render/project/src/browsers)
    process.env.HOME ? `${process.env.HOME}/.cache/ms-playwright` : "",
    "/opt/render/project/src/browsers",           // Render project directory (absolute fallback)
    "/opt/render/.cache/ms-playwright",           // Render build cache (sometimes accessible)
    "/root/.cache/ms-playwright",                 // EC2 / Docker root user
  ].filter(Boolean);

  console.log(`[chromium] searching cache dirs: ${JSON.stringify(cacheDirs)}`);

  for (const dir of cacheDirs) {
    if (!existsSync(dir)) {
      console.log(`[chromium] dir not found: ${dir}`);
      continue;
    }
    try {
      const found = execSync(
        `find "${dir}" \\( -name "chrome" -o -name "chrome-headless-shell" \\) 2>/dev/null | head -1`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" }
      ).trim();
      console.log(`[chromium] find in ${dir} → "${found}"`);
      if (found && existsSync(found)) return found;
    } catch {
      console.log(`[chromium] find failed in ${dir}`);
    }
  }

  throw new Error(
    "No Chromium/Chrome binary found. " +
      "Install Chrome, or run `npx playwright install chromium`, " +
      "or set LOCAL_CHROMIUM_EXECUTABLE in your .env file."
  );
}
