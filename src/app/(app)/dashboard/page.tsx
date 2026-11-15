import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

const EXPLORE = [
  {
    href: "/programs",
    title: "Compare the programs",
    body: "See what each program involves, why it works, and preview the weights with your own numbers.",
  },
  {
    href: "/exercises",
    title: "Exercise library",
    body: "How to do each lift, which muscles it works, and easier options to start with.",
  },
];

const COMING_UP = [
  { title: "Set up your program", body: "Pick a program, your training days and starting weights, with every option explained." },
  { title: "Your training calendar", body: "Workout and rest days by month. A missed workout simply moves to your next training day." },
  { title: "Log your sessions", body: "Sets, reps, accessories, how it felt and notes, exportable for review." },
];

export default async function DashboardPage() {
  // Every protected page checks the session itself; layouts alone are not enough.
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Hi, {user.displayName}</h1>
      <p className="mt-2 text-muted">
        Explore the programs and exercises while setup and the calendar are being built. The{" "}
        <span className="font-medium text-ink">Plates</span> button in the corner works on every page.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {EXPLORE.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block h-full rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/60 hover:shadow-sm">
              <h2 className="font-semibold text-ink">{item.title} →</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Coming next</h2>
      <ol className="mt-3 grid gap-4 sm:grid-cols-3">
        {COMING_UP.map((item) => (
          <li key={item.title} className="rounded-2xl border border-dashed border-line p-5">
            <h3 className="font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
