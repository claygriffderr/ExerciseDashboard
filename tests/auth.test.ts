import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../src/lib/auth/password";
import {
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  looksLikeSessionToken,
  shouldRenewSession,
} from "../src/lib/auth/tokens";
import { sessionCookieName, sessionCookieOptions } from "../src/lib/auth/cookie";
import { loginSchema, signupSchema } from "../src/lib/auth/validation";

describe("passwords", () => {
  it("hashes with Argon2id at the OWASP baseline and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.ok(!hash.includes("correct horse battery"));
    assert.equal(await verifyPassword(hash, "correct horse battery"), true);
    assert.equal(await verifyPassword(hash, "wrong horse battery"), false);
  });

  it("salts each hash", async () => {
    assert.notEqual(await hashPassword("same password!"), await hashPassword("same password!"));
  });

  it("treats a malformed hash as a mismatch instead of throwing", async () => {
    assert.equal(await verifyPassword("not-a-hash", "anything"), false);
  });

  it("dummy verification always fails", async () => {
    assert.equal(await verifyAgainstDummy("dummy-password-for-timing-equalization"), false);
  });
});

describe("session tokens", () => {
  it("are 256-bit, URL-safe and unique", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    assert.equal(a.length, 43);
    assert.ok(looksLikeSessionToken(a));
    assert.notEqual(a, b);
  });

  it("are stored only as a SHA-256 hash", () => {
    const t = generateSessionToken();
    const h = hashSessionToken(t);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, hashSessionToken(t));
    assert.notEqual(h, t);
  });

  it("rejects malformed tokens before any lookup", () => {
    assert.equal(looksLikeSessionToken(undefined), false);
    assert.equal(looksLikeSessionToken(""), false);
    assert.equal(looksLikeSessionToken("short"), false);
    assert.equal(looksLikeSessionToken("a".repeat(42) + "!"), false);
  });

  it("renews only once less than half the lifetime is left", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const fresh = new Date(now.getTime() + SESSION_TTL_MS - 1000);
    const old = new Date(now.getTime() + SESSION_TTL_MS / 2 - 1000);
    assert.equal(shouldRenewSession(fresh, now), false);
    assert.equal(shouldRenewSession(old, now), true);
  });
});

describe("session cookie", () => {
  it("uses the __Host- prefix and Secure flag over HTTPS", () => {
    assert.equal(sessionCookieName(true), "__Host-ed_session");
    const opts = sessionCookieOptions(true, new Date());
    assert.equal(opts.secure, true);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, "lax");
    assert.equal(opts.path, "/");
  });

  it("drops the prefix when Secure is off (browsers would reject it)", () => {
    assert.equal(sessionCookieName(false), "ed_session");
    assert.equal(sessionCookieOptions(false, new Date()).secure, false);
  });
});

describe("form validation", () => {
  const valid = {
    displayName: "  Mom ",
    email: "  Mom@Example.COM ",
    password: "a long enough phrase",
    confirmPassword: "a long enough phrase",
  };

  it("normalizes email and name", () => {
    const r = signupSchema.parse(valid);
    assert.equal(r.email, "mom@example.com");
    assert.equal(r.displayName, "Mom");
  });

  it("requires a minimum password length", () => {
    const r = signupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    assert.equal(r.success, false);
  });

  it("requires matching passwords", () => {
    const r = signupSchema.safeParse({ ...valid, confirmPassword: "something else entirely" });
    assert.equal(r.success, false);
    assert.deepEqual(r.error?.issues[0].path, ["confirmPassword"]);
  });

  it("rejects bad emails and oversized passwords at login", () => {
    assert.equal(loginSchema.safeParse({ email: "nope", password: "x" }).success, false);
    assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(300) }).success, false);
    assert.equal(loginSchema.safeParse({ email: "A@B.co", password: "x" }).success, true);
  });
});
