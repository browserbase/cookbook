import express, { type Request, type Response, type NextFunction } from "express";
import { randomBytes, randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { loginPage, requestPage, verifyPage, invalidPage, documentsPage } from "./portal-pages.ts";

import { otpSubject, senderAddress, type OtpRequest } from "./otp-message.ts";

const MINUTE = 60_000;
const COOKIE = "tax_portal_session";
type Phase =
  | { kind: "anonymous" | "ready" }
  | { kind: "sending"; attempt: symbol }
  | { kind: "issued"; request: OtpRequest; code: string; deadline: number; attempts: number }
  | { kind: "authenticated"; deadline: number };
type Session = {
  id: string; csrf: string; deadline: number; phase: Phase;
  sends: number; failures: number; nextSend: number;
};
type Options = {
  origin: string;
  recipient?: string;
  deliverCode: (message: { recipient: string; code: string; requestId: string }) => Promise<{ sender: string; subject: string }>;
  statementPath: string;
  clock?: () => number;
};

export function createTaxPortal(options: Options) {
  const origin = new URL(options.origin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Portal origin must be an HTTP(S) origin without credentials or a path.");
  }
  const now = options.clock ?? (() => performance.now());
  const recipient = options.recipient?.trim();
  const sessions = new Map<string, Session>();
  let pendingDeliveries = 0;
  let sendWindow = now();
  let windowSends = 0;
  const token = () => randomBytes(32).toString("hex");
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "same-origin");
    if (req.headers.host !== origin.host) return res.status(421).send("Use the configured portal origin.");
    if (req.method === "POST" && req.headers.origin && req.headers.origin !== origin.origin) {
      return res.status(403).send("Invalid request origin.");
    }
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: "4kb", parameterLimit: 10 }));
  app.use(express.json({ limit: "4kb" }));

  function prune() {
    const time = now();
    for (const [id, session] of sessions) {
      if (time >= session.deadline) sessions.delete(id);
      else if ((session.phase.kind === "issued" || session.phase.kind === "authenticated") &&
               time >= session.phase.deadline) session.phase = { kind: "ready" };
    }
  }
  function sessionFor(req: Request) {
    prune();
    const cookies = (req.headers.cookie ?? "").split(";").map(value => value.trim());
    const matches = cookies.filter(value => value.startsWith(`${COOKIE}=`));
    if (matches.length !== 1) return undefined;
    const id = matches[0]!.slice(COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(id) ? sessions.get(id) : undefined;
  }
  function setCookie(res: Response, session: Session) {
    res.cookie(COOKIE, session.id, {
      httpOnly: true, sameSite: "lax", secure: origin.protocol === "https:", path: "/",
      maxAge: Math.max(0, session.deadline - now()),
    });
  }
  function createSession(res: Response) {
    prune();
    if (sessions.size >= 1000) return undefined;
    const session: Session = {
      id: token(), csrf: token(), deadline: now() + 30 * MINUTE,
      phase: { kind: "anonymous" }, sends: 0, failures: 0, nextSend: 0,
    };
    sessions.set(session.id, session);
    setCookie(res, session);
    return session;
  }
  function rotate(res: Response, session: Session, phase: Phase) {
    sessions.delete(session.id);
    const replacement = { ...session, id: token(), csrf: token(), phase };
    sessions.set(replacement.id, replacement);
    setCookie(res, replacement);
    return replacement;
  }
  function requireSession(req: Request, res: Response) {
    const session = sessionFor(req);
    if (!session) res.status(401).send("Session expired or missing. Open the login page.");
    return session;
  }
  app.use((req, res, next) => {
    if (req.method !== "POST") return next();
    const session = requireSession(req, res);
    if (!session) return;
    if (typeof req.body?.csrf !== "string" || req.body.csrf !== session.csrf) {
      return res.status(403).send("Invalid form token. Reload the portal page.");
    }
    next();
  });
  app.get("/", (req, res) => {
    const session = sessionFor(req) ?? createSession(res);
    if (!session) return res.status(503).send("Demo session capacity reached. Try again later.");
    res.send(loginPage(session.csrf));
  });
  app.post("/login", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (req.body?.username !== "demo_agent" || req.body?.password !== "demo123") {
      return res.status(401).send(loginPage(session.csrf));
    }
    const replacement = rotate(res, session, { kind: "ready" });
    res.send(requestPage(replacement.csrf));
  });
  app.get("/verify-otp", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.phase.kind === "anonymous") return res.status(401).send(loginPage(session.csrf));
    if (session.phase.kind === "authenticated") return res.redirect("/documents");
    if (session.phase.kind === "sending") return res.status(409).send("Email request is still pending. Return here shortly.");
    res.send(session.phase.kind === "issued" ? verifyPage(session.csrf, recipient ?? "", session.phase.request) : requestPage(session.csrf));
  });
  app.post("/send-otp", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.phase.kind === "anonymous") return res.status(401).send("Complete the demo login first.");
    if (session.phase.kind === "sending") return res.status(409).send("An email request is already pending.");
    if (session.phase.kind === "authenticated") return res.status(409).send("This session is already verified.");
    if (!recipient) return res.status(503).send("Email delivery is not configured.");
    const time = now();
    if (time >= sendWindow + 10 * MINUTE) { sendWindow = time; windowSends = 0; }
    if (session.sends >= 5 || session.failures >= 10 || time < session.nextSend || windowSends >= 20) {
      return res.status(429).send("Demo email or verification limit reached. Try again later.");
    }
    if (pendingDeliveries >= 20) return res.status(503).send("Email delivery is busy. Try again later.");
    session.sends++;
    windowSends++;
    session.nextSend = time + MINUTE;
    const attempt = Symbol("delivery");
    session.phase = { kind: "sending", attempt };
    const requestId = randomBytes(16).toString("hex");
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const ownsAttempt = () => sessions.get(session.id) === session && now() < session.deadline &&
      session.phase.kind === "sending" && session.phase.attempt === attempt;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    pendingDeliveries++;
    // An HTTP timeout does not cancel the underlying provider operation.
    const delivery = Promise.resolve().then(() => options.deliverCode({ recipient, code, requestId }));
    delivery.then(() => { pendingDeliveries--; }, () => { pendingDeliveries--; });
    try {
      const receipt = await Promise.race([
        delivery,
        new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Delivery timeout")), 30_000); }),
      ]);
      if (!ownsAttempt()) return res.status(409).send("This code request is no longer active. Return to the login page.");
      if (!receipt || receipt.subject !== otpSubject(requestId) || senderAddress(receipt.sender) !== receipt.sender) {
        throw new Error("Email acceptance metadata does not match this request.");
      }
      session.phase = { kind: "issued", request: { requestId, ...receipt }, code, deadline: Math.min(now() + 10 * MINUTE, session.deadline), attempts: 5 };
      return res.redirect("/verify-otp");
    } catch {
      if (ownsAttempt()) session.phase = { kind: "ready" };
      return res.status(502).send("Could not send the verification email. Try again.");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  });
  app.post("/verify-otp", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const challenge = session.phase;
    if (challenge.kind !== "issued" || session.failures >= 10) {
      return res.status(401).send("No active code. Request a new code from the verification page.");
    }
    const code = req.body?.otp;
    if (typeof code === "string" && /^\d{6}$/.test(code) && code === challenge.code) {
      rotate(res, session, { kind: "authenticated", deadline: Math.min(now() + 10 * MINUTE, session.deadline) });
      return res.redirect("/documents");
    }
    challenge.attempts--;
    session.failures++;
    if (challenge.attempts <= 0 || session.failures >= 10) session.phase = { kind: "ready" };
    res.status(401).send(invalidPage(session.csrf));
  });
  function requireAuthentication(req: Request, res: Response, next: NextFunction) {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.phase.kind !== "authenticated") return res.status(401).send("Verify this session before accessing documents.");
    next();
  }
  app.get("/documents", requireAuthentication, (_req, res) => res.send(documentsPage()));
  app.get("/public/tax-statement-2024.pdf", requireAuthentication, (_req, res, next) => {
    res.sendFile(options.statementPath, { cacheControl: false, dotfiles: "deny" }, error => {
      if (error) next(error);
    });
  });
  app.use((_req, res) => res.status(404).send("Not found."));
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    res.status(status === 404 ? 404 : status === 413 ? 413 : status === 400 ? 400 : 500).send("Request could not be completed.");
  });
  return app;
}
