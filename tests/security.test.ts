import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryRateLimitStore, consume, formatRetryAfter } from "../src/lib/security/rate-limit";
import { clientIpFromForwardedFor, safeRedirectPath } from "../src/lib/security/request";
import { allowSignups, secureCookies, trustedProxyCount } from "../src/lib/config";

describe("rate limiting", () => {
  const rule = { limit: 3, windowMs: 60_000 };

  it("allows up to the limit, then blocks until the window resets", async () => {
    const store = new MemoryRateLimitStore();
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 3; i++) assert.equal((await consume(store, "k", rule, t0)).allowed, true);
    const blocked = await consume(store, "k", rule, new Date(t0.getTime() + 10_000));
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 50_000);
    assert.equal((await consume(store, "k", rule, new Date(t0.getTime() + 60_000))).allowed, true);
  });

  it("keeps keys separate and can be cleared", async () => {
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 4; i++) await consume(store, "a", rule);
    assert.equal((await consume(store, "b", rule)).allowed, true);
    await store.clear("a");
    assert.equal((await consume(store, "a", rule)).allowed, true);
  });

  it("formats waits in whole minutes", () => {
    assert.equal(formatRetryAfter(1), "1 minute");
    assert.equal(formatRetryAfter(14 * 60_000 + 1), "15 minutes");
  });
});

describe("client IP", () => {
  it("uses the socket address Next.js fills in when there is no proxy", () => {
    assert.equal(clientIpFromForwardedFor("10.0.0.5", 0), "10.0.0.5");
  });
  it("uses the address our one reverse proxy appended, ignoring forged entries", () => {
    assert.equal(clientIpFromForwardedFor("6.6.6.6, 203.0.113.9", 1), "203.0.113.9");
  });
  it("skips inner proxies when there are several", () => {
    assert.equal(clientIpFromForwardedFor("6.6.6.6, 203.0.113.9, 172.18.0.2", 2), "203.0.113.9");
  });
  it("never reads past the left end", () => {
    assert.equal(clientIpFromForwardedFor("203.0.113.9", 3), "203.0.113.9");
    assert.equal(clientIpFromForwardedFor(null, 0), "unknown");
    assert.equal(clientIpFromForwardedFor(" , ", 0), "unknown");
  });
});

describe("safe redirects", () => {
  it("allows same-site paths", () => {
    assert.equal(safeRedirectPath("/calendar?month=2026-11"), "/calendar?month=2026-11");
  });
  it("blocks other sites and tricks", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "dashboard",
      "/\tevil",
      "",
      undefined,
      ["/x"],
    ]) {
      assert.equal(safeRedirectPath(bad), "/dashboard", String(bad));
    }
  });
});

describe("config", () => {
  it("reads booleans and numbers from the environment", () => {
    const saved = { ...process.env };
    try {
      process.env.ALLOW_SIGNUPS = "false";
      assert.equal(allowSignups(), false);
      delete process.env.ALLOW_SIGNUPS;
      assert.equal(allowSignups(), true);

      process.env.SECURE_COOKIES = "off";
      assert.equal(secureCookies(), false);
      process.env.SECURE_COOKIES = "true";
      assert.equal(secureCookies(), true);

      process.env.TRUSTED_PROXY_COUNT = "2";
      assert.equal(trustedProxyCount(), 2);
      process.env.TRUSTED_PROXY_COUNT = "-1";
      assert.equal(trustedProxyCount(), 0);
    } finally {
      process.env = saved;
    }
  });
});
