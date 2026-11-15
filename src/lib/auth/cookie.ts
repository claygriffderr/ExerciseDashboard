/**
 * Session cookie settings, shared by the server and the request proxy.
 *
 * Over HTTPS the cookie uses the "__Host-" prefix, which browsers only accept
 * when it is Secure, has Path=/ and no Domain, so it cannot be set or
 * overwritten by another subdomain.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? "__Host-ed_session" : "ed_session";
}

export function sessionCookieOptions(secure: boolean, expires: Date) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}
