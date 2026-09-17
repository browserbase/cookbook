import { createRequire } from "node:module";

const { z } = createRequire(import.meta.url)("zod");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function claimJob(jobs, candidate) {
  const existing = jobs.get(candidate.request.job_id);
  if (existing) {
    const sameRequest =
      canonicalJson(existing.request) === canonicalJson(candidate.request);
    if (!sameRequest || existing.portal.id !== candidate.portal.id) {
      throw new Error(
        `Job ID ${candidate.request.job_id} is already used by a different request`,
      );
    }
    return { state: existing, created: false };
  }
  jobs.set(candidate.request.job_id, candidate);
  return { state: candidate, created: true };
}

export function portalSupportsPaymentInstrument(request, portal) {
  if (request.type !== "bill_pay" || !request.payment_instrument) return true;
  return (portal.billPaySteps ?? []).some(
    (step) =>
      step.instruction.includes("{{account_number}}") &&
      step.instruction.includes("{{routing_number}}"),
  );
}

export function replaceTemplateVars(instruction, request, mfaCode) {
  let result = instruction;
  result = result.replace(/\{\{username\}\}/g, () => request.username);
  result = result.replace(/\{\{password\}\}/g, () => request.password);
  if (request.payment_instrument) {
    result = result.replace(
      /\{\{account_number\}\}/g,
      () => request.payment_instrument.account_number,
    );
    result = result.replace(
      /\{\{routing_number\}\}/g,
      () => request.payment_instrument.routing_number,
    );
  }
  if (request.payment_amount_in_cents != null) {
    const dollars = (request.payment_amount_in_cents / 100).toFixed(2);
    result = result.replace(/\{\{payment_amount\}\}/g, () => dollars);
  }
  if (mfaCode) result = result.replace(/\{\{mfa_code\}\}/g, () => mfaCode);

  const unresolved = result.match(/\{\{[a-z0-9_]+\}\}/gi);
  if (unresolved) {
    throw new Error(`Missing template value for ${unresolved.join(", ")}`);
  }
  return result;
}

export function validateJobData(request, value) {
  const contractDate = z.string().refine(isContractDate, {
    message: "date must use YYYY-MM-DD HH:mm:ss and name a real UTC date",
  });
  if (request.type === "bill_pull") {
    return z
      .object({ balance: z.number().finite(), due_date: contractDate })
      .strict()
      .parse(value);
  }

  const parsed = z
    .object({
      transaction_id: z.string().trim().min(1),
      payment_date: contractDate,
      amount_paid: z.number().finite().positive(),
    })
    .strict()
    .parse(value);
  const requestedAmount = request.payment_amount_in_cents;
  if (requestedAmount == null) {
    throw new Error("payment_amount_in_cents is required for bill_pay");
  }
  if (Math.round(parsed.amount_paid * 100) !== requestedAmount) {
    throw new Error(
      `Confirmed amount ${parsed.amount_paid.toFixed(2)} does not match requested amount ${(requestedAmount / 100).toFixed(2)}`,
    );
  }
  return parsed;
}

function isContractDate(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

export function requireSuccessfulStepAction(action, description) {
  if (action?.data?.success !== true) {
    const detail = action?.data?.message ? `: ${action.data.message}` : "";
    throw new Error(`Action failed: ${description}${detail}`);
  }
}
