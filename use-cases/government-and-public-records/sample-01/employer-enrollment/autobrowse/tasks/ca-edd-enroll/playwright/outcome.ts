import type { Page } from "playwright";

export async function assertEmployerDashboard(page: Page): Promise<void> {
  const [title, url, content] = await Promise.all([
    page.title(),
    Promise.resolve(page.url()),
    page.content(),
  ]);
  const stillVerifying = /macotp|login|verify|verification|otp|error/i.test(
    `${title} ${url}`,
  );
  const hasDashboardSignal =
    /Employer Services Online/i.test(content) &&
    /My Accounts|Account Management|Payroll Tax/i.test(content);
  if (stillVerifying || !hasDashboardSignal) {
    throw new Error(
      `OTP submission did not reach the authenticated Employer Services Online dashboard (title=${JSON.stringify(title)}, url=${url})`,
    );
  }
}
