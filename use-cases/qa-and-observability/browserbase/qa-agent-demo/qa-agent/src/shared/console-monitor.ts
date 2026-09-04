import type { Page } from "@browserbasehq/stagehand";

export async function monitorConsole(page: Page): Promise<string[]> {
  const consoleLogs: string[] = [];

  await page.on("console", (event) => {
    const type = String(event.params.type);
    if (type === "error" || type === "warning") {
      consoleLogs.push(`[${type.toUpperCase()}] ${JSON.stringify(event.params.args ?? [])}`);
    }
  });
  await page.addInitScript(() => {
    window.addEventListener("error", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.documentElement) {
        console.error("[RESOURCE_ERROR]", target.getAttribute("src") ?? target.getAttribute("href") ?? target.tagName);
      } else {
        console.error("[PAGE_ERROR]", event.message);
      }
    }, true);
    window.addEventListener("unhandledrejection", (event) => {
      console.error("[UNHANDLED_REJECTION]", String(event.reason));
    });
  });

  return consoleLogs;
}
