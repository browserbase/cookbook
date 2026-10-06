import { Link, type Card, type SpendRequest } from "@stripe/link-sdk";

export interface ApprovedLinkCard {
  card: Card;
  merchantName?: string;
  merchantUrl: string;
  spendRequestId: string;
}

export function requireLinkAccessToken(): string {
  const token = process.env.LINK_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Stripe Link is not configured. Set LINK_ACCESS_TOKEN in the server environment.",
    );
  }
  return token;
}

export async function retrieveApprovedLinkCard(
  spendRequestId: string,
): Promise<ApprovedLinkCard> {
  try {
    const link = new Link({ accessToken: requireLinkAccessToken() });
    const request = await link.spendRequests.retrieve(spendRequestId, { include: ["card"] });
    return approvedLinkCard(request, spendRequestId);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Stripe Link is not configured.")) {
      throw error;
    }
    throw new Error(
      "Could not retrieve an approved Link payment credential. Check the spend request and Link authorization.",
    );
  }
}

export function approvedLinkCard(
  request: SpendRequest | null,
  spendRequestId: string,
): ApprovedLinkCard {
  if (!request || request.id !== spendRequestId) {
    throw new Error("The Link spend request was not found.");
  }
  if (request.status !== "approved") {
    throw new Error(`The Link spend request is not approved. Current status: ${request.status}.`);
  }
  if (request.credential_type && request.credential_type !== "card") {
    throw new Error("This checkout requires a Link card spend request.");
  }
  if (!request.card) {
    throw new Error("The approved Link spend request did not return a card credential.");
  }
  if (!request.merchant_url) {
    throw new Error("The Link spend request does not identify its merchant URL.");
  }
  if (request.card.valid_until) {
    const validUntil = Date.parse(request.card.valid_until);
    if (!Number.isNaN(validUntil) && validUntil <= Date.now()) {
      throw new Error("The Link card credential expired. Create a new spend request.");
    }
  }
  return {
    card: request.card,
    merchantName: request.merchant_name,
    merchantUrl: request.merchant_url,
    spendRequestId: request.id,
  };
}

export function allowedLinkCheckoutHosts(merchantUrl: string): string[] {
  let merchantHost: string;
  try {
    const url = new URL(merchantUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    merchantHost = url.hostname.toLowerCase();
    if (!merchantHost) throw new Error("missing host");
  } catch {
    throw new Error("The Link spend request has an invalid merchant URL.");
  }
  return [merchantHost];
}

export function formatLinkExpiry(
  month: number,
  year: number,
  format: "MM/YY" | "MMYY" | "MM/YYYY",
): string {
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year);
  const yy = yyyy.slice(-2);
  if (format === "MMYY") return `${mm}${yy}`;
  if (format === "MM/YYYY") return `${mm}/${yyyy}`;
  return `${mm}/${yy}`;
}
