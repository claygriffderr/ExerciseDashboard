import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/dal";

const FEATURES = [
  {
    title: "A plan that fits you",
    body: "Pick a program, how many days you train and where you're starting from. New to lifting? Start with a gentle on-ramp.",
  },
  {
    title: "Your month at a glance",
    body: "See workout and rest days on a calendar. Tap a workout to adjust it or log what you did.",
  },
  {
    title: "Log it, learn from it",
    body: "Record sets, accessories, how it felt and notes, then export your history to look for patterns.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <Link href="/dashboard" className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink hover:bg-accent-strong">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-4 py-2 font-medium text-ink hover:bg-line/50">
                Log in
              </Link>
              <Link href="/signup" className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink hover:bg-accent-strong">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Get stronger with a plan you can actually follow.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Build an evidence-based strength program around the 5/3/1 method, schedule it on a calendar, and track every
          session.
        </p>
        {!user && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink hover:bg-accent-strong">
              Create an account
            </Link>
            <Link href="/login" className="rounded-lg border border-line bg-surface px-5 py-3 font-medium text-ink hover:bg-line/40">
              I already have one
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
