import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_LIFETIME_SECONDS = 900;
export const RELEASE_GRACE_SECONDS = 300;

type SessionClaims = {
  v: 1;
  sessionId: string;
  conversationId: string;
  projectId: string;
  issuedAt: number;
  expiresAt: number;
};

export class InvalidSessionCapability extends Error {
  constructor() {
    super('Invalid or expired browser session');
    this.name = 'InvalidSessionCapability';
  }
}

function signingKey(secret: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error('BROWSEGPT_SESSION_SECRET must contain 32 random bytes encoded as 64 hexadecimal characters');
  }
  return Buffer.from(secret, 'hex');
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const claims = value as Record<string, unknown>;
  const keys = ['v', 'sessionId', 'conversationId', 'projectId', 'issuedAt', 'expiresAt'];
  return Object.keys(claims).length === keys.length && keys.every(key => Object.hasOwn(claims, key)) &&
    claims.v === 1 && validId(claims.sessionId) && validId(claims.conversationId) && validId(claims.projectId) &&
    typeof claims.issuedAt === 'number' && Number.isSafeInteger(claims.issuedAt) && claims.issuedAt >= 0 &&
    typeof claims.expiresAt === 'number' && Number.isSafeInteger(claims.expiresAt) &&
    claims.expiresAt - claims.issuedAt === SESSION_LIFETIME_SECONDS;
}

export function issueSessionCapability(
  identity: { sessionId: string; conversationId: string; projectId: string },
  secret: string,
  now = Math.floor(Date.now() / 1000),
): { capability: string; expiresAt: number } {
  const key = signingKey(secret);
  const claims: SessionClaims = {
    v: 1,
    sessionId: identity.sessionId,
    conversationId: identity.conversationId,
    projectId: identity.projectId,
    issuedAt: now,
    expiresAt: now + SESSION_LIFETIME_SECONDS,
  };
  if (!isClaims(claims)) throw new InvalidSessionCapability();
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', key).update(`browsegpt-session-v1.${payload}`).digest('base64url');
  return { capability: `${payload}.${signature}`, expiresAt: claims.expiresAt };
}

export function verifySessionCapability(
  capability: string | null,
  secret: string,
  projectId: string,
  purpose: 'operate' | 'release' = 'operate',
  now = Math.floor(Date.now() / 1000),
): SessionClaims {
  const key = signingKey(secret);
  if (typeof capability !== 'string' || capability.length > 2048 || !Number.isSafeInteger(now) || now < 0) {
    throw new InvalidSessionCapability();
  }
  const parts = capability.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) {
    throw new InvalidSessionCapability();
  }
  const [payload, signature] = parts;
  const actual = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', key).update(`browsegpt-session-v1.${payload}`).digest();
  if (actual.length !== expected.length || actual.toString('base64url') !== signature || !timingSafeEqual(actual, expected)) {
    throw new InvalidSessionCapability();
  }
  let claims: unknown;
  try {
    const bytes = Buffer.from(payload, 'base64url');
    if (bytes.toString('base64url') !== payload) throw new InvalidSessionCapability();
    claims = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new InvalidSessionCapability();
  }
  const grace = purpose === 'release' ? RELEASE_GRACE_SECONDS : 0;
  if (!isClaims(claims) || claims.projectId !== projectId || claims.issuedAt > now || now >= claims.expiresAt + grace) {
    throw new InvalidSessionCapability();
  }
  return claims;
}
