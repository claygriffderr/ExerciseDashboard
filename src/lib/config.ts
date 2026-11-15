/**
 * Runtime settings read from environment variables. Read on each call so a
 * change to the environment (or a test) takes effect without a rebuild.
 */

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

/** Whether new accounts can be created. Defaults to true. */
export function allowSignups(): boolean {
  return readBool(process.env.ALLOW_SIGNUPS, true);
}

/**
 * Whether session cookies are HTTPS-only. Defaults to true in production.
 * Turn off only for plain-HTTP use on a trusted home network.
 */
export function secureCookies(): boolean {
  return readBool(process.env.SECURE_COOKIES, process.env.NODE_ENV === "production");
}

/** Number of reverse proxies in front of the app (for finding the client IP). */
export function trustedProxyCount(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
