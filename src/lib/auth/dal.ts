import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionToken, validateSessionToken, type SessionUser } from "./session";

/**
 * Data access layer entry point: the signed-in user for this request, or null.
 * Wrapped in React's cache() so several components can call it per request
 * while the database is hit once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
});

/** Use at the top of every protected page, Server Action and Route Handler. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
