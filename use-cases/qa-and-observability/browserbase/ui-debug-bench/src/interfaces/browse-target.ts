export type BrowseTargetMode = "local" | "remote" | "auto-connect" | "cdp" | "cdp-launch";

export interface BrowseTargetConfig {
  mode: BrowseTargetMode;
  args: string[];
  stopSession?: string;
}

export function browseTargetArgs(session: string): BrowseTargetConfig {
  const mode = (process.env.BROWSE_TARGET ?? "local") as BrowseTargetMode;
  if (mode === "local") {
    return { mode, args: ["--local", "--headless", "--session", session], stopSession: session };
  }
  if (mode === "remote") {
    return { mode, args: ["--remote", "--session", session], stopSession: session };
  }
  if (mode === "auto-connect") {
    return { mode, args: ["--auto-connect", "--session", session], stopSession: session };
  }
  if (mode === "cdp") {
    const cdp = process.env.BROWSE_CDP;
    if (!cdp) throw new Error("BROWSE_TARGET=cdp requires BROWSE_CDP=<url|port>");
    return { mode, args: ["--cdp", cdp], stopSession: "default" };
  }
  if (mode === "cdp-launch") {
    throw new Error("BROWSE_TARGET=cdp-launch is resolved by launching a temporary browser first.");
  }
  throw new Error(`Unsupported BROWSE_TARGET ${mode}. Expected local, remote, auto-connect, cdp, or cdp-launch.`);
}
