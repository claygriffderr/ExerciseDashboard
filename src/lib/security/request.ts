/**
 * Pick the client IP out of an X-Forwarded-For header.
 *
 * Each reverse proxy appends the address it received the request from, so the
 * right-most entries are the trustworthy ones and anything further left may be
 * forged by the client. With N trusted proxies, the real client is the Nth
 * entry from the right (the one our outermost proxy added).
 *
 * With no proxy, Next.js fills the header with the socket address, but only
 * when the client did not send one itself. So when the app is exposed directly
 * to the internet, this value can be forged; the per-account login limit still
 * applies. Serve the app behind a reverse proxy (which you need for HTTPS
 * anyway) and set TRUSTED_PROXY_COUNT to close that gap.
 */
export function clientIpFromForwardedFor(
  header: string | null | undefined,
  trustedProxyCount: number,
): string {
  if (!header) return "unknown";
  const hops = header
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length === 0) return "unknown";
  const index = Math.max(0, hops.length - Math.max(1, trustedProxyCount));
  return hops[index];
}

/**
 * Only allow redirects to paths on this site, so a crafted login link
 * (/login?next=https://evil.example) cannot send someone elsewhere.
 */
export function safeRedirectPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://placeholder.invalid");
    if (url.origin !== "http://placeholder.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
