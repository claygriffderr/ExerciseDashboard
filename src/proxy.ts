import { NextResponse, type NextRequest } from "next/server";
import { secureCookies } from "@/lib/config";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/cookie";
import { SESSION_TTL_MS } from "@/lib/auth/tokens";

/** Paths that need a signed-in user. The real check happens in each page. */
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/calendar", "/workouts", "/settings"];

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next.js and React emit some inline style attributes, so allow those.
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No "upgrade-insecure-requests": every resource is same-origin, so it adds
    // nothing over HTTPS, and over plain HTTP it would break CSS and scripts.
  ]
    .filter(Boolean)
    .join("; ");
}

export function proxy(request: NextRequest) {
  const secure = secureCookies();
  const cookieName = sessionCookieName(secure);
  const token = request.cookies.get(cookieName)?.value;
  const { pathname, search } = request.nextUrl;

  // Optimistic check: bounce obviously signed-out visitors to the login page.
  if (!token && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Slide the cookie's expiry forward on page views. The database decides
  // whether the session is still valid, so this cannot extend a dead session.
  if (token && request.method === "GET") {
    response.cookies.set(cookieName, token, sessionCookieOptions(secure, new Date(Date.now() + SESSION_TTL_MS)));
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
