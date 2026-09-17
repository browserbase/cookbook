export type OtpRequest = { requestId: string; sender: string; subject: string };

export function otpSubject(requestId: string) {
  if (!/^[a-f0-9]{32}$/.test(requestId)) throw new Error("Invalid OTP request identifier.");
  return `Tax Portal Verification - ${requestId}`;
}

export function senderAddress(from: string) {
  const value = from.trim();
  if (/[\r\n]/.test(value)) throw new Error("FROM_EMAIL must contain one mailbox.");
  const address = value.includes("<") ? /^[^<>]*<([^<>]+)>$/.exec(value)?.[1] : value;
  if (!address || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(address)) {
    throw new Error("FROM_EMAIL must be an unquoted mailbox, optionally with a display name.");
  }
  return address.toLowerCase();
}

export function parseOtpRequest(value: unknown): OtpRequest {
  if (!value || typeof value !== "object" || !("requestId" in value) || typeof value.requestId !== "string" ||
      !("sender" in value) || typeof value.sender !== "string" || !("subject" in value) || typeof value.subject !== "string" ||
      value.subject !== otpSubject(value.requestId) || value.sender !== senderAddress(value.sender)) {
    throw new Error("No valid active OTP request metadata.");
  }
  return { requestId: value.requestId, sender: value.sender, subject: value.subject };
}

export function selectOtp(messages: unknown, value: unknown): string | null {
  const request = parseOtpRequest(value);
  if (!Array.isArray(messages)) throw new Error("Unsupported message snapshot.");
  const matches: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || typeof message.sender !== "string" ||
        typeof message.subject !== "string" || typeof message.body !== "string") {
      throw new Error("Incomplete message snapshot.");
    }
    if (message.sender.toLowerCase() !== request.sender || message.subject !== request.subject) continue;
    const ids = [...message.body.matchAll(/Request ID:\s*([^\s]+)/g)].map(match => match[1]);
    if (!ids.includes(request.requestId)) continue;
    const codes = [...message.body.matchAll(/Verification code:\s*([^\s]+)/g)].map(match => match[1]);
    if (ids.length !== 1 || codes.length !== 1 || !/^\d{6}$/.test(codes[0]!)) {
      throw new Error("Ambiguous or malformed verification message.");
    }
    matches.push(codes[0]!);
  }
  if (matches.length > 1) throw new Error("Multiple messages match this verification request.");
  return matches[0] ?? null;
}
