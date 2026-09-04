import { spawn } from "node:child_process";

/**
 * Open a URL in the OS default browser, detached so it never blocks the caller.
 * Best-effort only: in headless/SSH environments this is a no-op — the caller
 * always also prints the URL so the user can open it manually.
 */
export function openUrl(url: string): void {
  try {
    if (process.platform === "darwin") {
      spawnDetached("open", [url]);
    } else if (process.platform === "win32") {
      spawnDetached("cmd", ["/c", "start", "", url]);
    } else {
      spawnDetached("xdg-open", [url]);
    }
  } catch {
    // ignore — the URL is always printed as a fallback
  }
}

export function spawnDetached(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}
