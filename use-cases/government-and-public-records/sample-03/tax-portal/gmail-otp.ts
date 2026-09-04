import type { Page } from "@browserbasehq/stagehand";
import { parseOtpRequest, selectOtp, type OtpRequest } from "./otp-message.ts";

export async function readPortalRequest(page: Page, portalOrigin: string) {
  const snapshot = await page.evaluate(() => ({
    origin: location.origin, pathname: location.pathname,
    requests: [...document.querySelectorAll<HTMLElement>("[data-otp-request]")].map(element => ({
      requestId: element.dataset.otpRequest, sender: element.dataset.otpSender, subject: element.dataset.otpSubject,
    })),
  }));
  if (snapshot.origin !== new URL(portalOrigin).origin || snapshot.pathname !== "/verify-otp" || snapshot.requests.length !== 1) {
    throw new Error("The portal has not confirmed one active email request.");
  }
  return parseOtpRequest(snapshot.requests[0]);
}

// Gmail's rendered DOM is an adapter boundary: unsupported layouts fail closed.
export function gmailSnapshot() {
  if (location.origin !== "https://mail.google.com") throw new Error("Sign into Gmail before retrieving the code.");
  const visible = (element: Element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const rows = [...document.querySelectorAll<HTMLElement>("tr.zA")].map((row, index) => ({
    index, visible: visible(row), subject: row.querySelector<HTMLElement>(".bog")?.innerText.trim() ?? "",
    senders: [...row.querySelectorAll(".yW [email]")].map(element => element.getAttribute("email")?.toLowerCase()),
  }));
  const headings = [...document.querySelectorAll<HTMLElement>("h2.hP")].filter(visible);
  const subject = headings.length === 1 ? headings[0]!.innerText.trim() : "";
  const messages = [...document.querySelectorAll<HTMLElement>(".adn")].filter(visible).flatMap(message => {
    const bodies = [...message.querySelectorAll<HTMLElement>(".a3s")].filter(visible);
    if (bodies.length === 0) return [];
    const senders = [...message.querySelectorAll(".gD[email]")].filter(visible);
    if (bodies.length !== 1 || senders.length !== 1 || !subject) throw new Error("Unsupported Gmail message layout.");
    const body = bodies[0]!;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const chunks: string[] = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && visible(parent) && !parent.closest("blockquote, .gmail_quote, script, style")) chunks.push(walker.currentNode.textContent ?? "");
    }
    return [{ sender: senders[0]!.getAttribute("email") ?? "", subject, body: chunks.join(" ").replace(/\s+/g, " ") }];
  });
  return { rows, messages };
}

export async function retrieveGmailOtp(page: Page, value: OtpRequest, search: (query: string) => Promise<void>) {
  const request = parseOtpRequest(value);
  if (new URL(await page.url()).origin !== "https://mail.google.com") throw new Error("Gmail login is required.");
  await search(`from:${request.sender} subject:"${request.subject}" "${request.requestId}"`);
  let opened = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const snapshot = await page.evaluate(gmailSnapshot);
    if (!opened) {
      const rows = snapshot.rows.filter(row => row.visible && row.subject === request.subject && row.senders.includes(request.sender));
      if (rows.length > 1) throw new Error("Multiple inbox rows match this request.");
      if (rows.length === 1) {
        await page.locator("tr.zA").nth(rows[0]!.index).click();
        opened = true;
      }
    } else {
      const code = selectOtp(snapshot.messages, request);
      if (code !== null) return code;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("No unique matching verification email became available.");
}
