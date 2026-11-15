import { createHash, randomBytes } from "node:crypto";

/** Sessions last 30 days and slide forward while the person keeps using the app. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Extend a session once less than half of its lifetime is left. */
export const SESSION_RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

/** 32 random bytes (256 bits), URL-safe. This value only ever lives in the cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The database stores only this hash, never the token itself. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function shouldRenewSession(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() < SESSION_RENEW_THRESHOLD_MS;
}

/** Cheap shape check before touching the database. */
export function looksLikeSessionToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
