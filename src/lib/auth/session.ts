import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { secureCookies } from "@/lib/config";
import { sessionCookieName, sessionCookieOptions } from "./cookie";
import {
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  looksLikeSessionToken,
  shouldRenewSession,
} from "./tokens";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

/** Create a session for the user and set the cookie. Server Actions / Route Handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({
    data: { id: hashSessionToken(token), userId, expiresAt },
  });
  const secure = secureCookies();
  (await cookies()).set(sessionCookieName(secure), token, sessionCookieOptions(secure, expiresAt));

  // Opportunistically remove this user's expired sessions.
  await prisma.authSession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
}

/** Look up the session behind a cookie token. Extends it when it is getting old. */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!looksLikeSessionToken(token)) return null;
  const id = hashSessionToken(token);
  const session = await prisma.authSession.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.authSession.deleteMany({ where: { id } });
    return null;
  }
  if (shouldRenewSession(session.expiresAt, now)) {
    await prisma.authSession.update({
      where: { id },
      data: { expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    });
  }
  return session.user;
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName(secureCookies()))?.value;
}

/** Log out this browser. Server Actions / Route Handlers only. */
export async function invalidateCurrentSession(): Promise<void> {
  const store = await cookies();
  const name = sessionCookieName(secureCookies());
  const token = store.get(name)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { id: hashSessionToken(token) } });
  }
  // Overwrite with an expired cookie carrying the same attributes. A bare
  // delete omits "Secure", and browsers ignore that for "__Host-" cookies.
  store.set(name, "", sessionCookieOptions(secureCookies(), new Date(0)));
}
