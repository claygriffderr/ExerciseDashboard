import Link from "next/link";
import { connection } from "next/server";

export default async function NotFound() {
  // Render per request so the page gets this request's CSP nonce.
  await connection();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="text-muted">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="font-medium text-accent hover:underline">
        Go to the home page
      </Link>
    </main>
  );
}
