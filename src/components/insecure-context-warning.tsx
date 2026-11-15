"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Secure session cookies are dropped by browsers on plain-HTTP pages (other
 * than localhost), which makes logging in silently fail. Explain that instead.
 */
export function InsecureContextWarning({ secureCookies }: { secureCookies: boolean }) {
  const insecure = useSyncExternalStore(
    subscribe,
    () => !window.isSecureContext,
    () => false,
  );
  if (!secureCookies || !insecure) return null;
  return (
    <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-ink">
      This page isn&apos;t using HTTPS, so your browser won&apos;t keep you logged in. Open the app over HTTPS (or at
      http://localhost on the computer running it), or ask whoever runs it to set <code>SECURE_COOKIES=false</code>{" "}
      for home-network use.
    </div>
  );
}
