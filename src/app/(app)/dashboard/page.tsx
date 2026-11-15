import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

const COMING_UP = [
  { step: "Next", title: "Set up your program", body: "Choose a program, training days and starting weights, with an explanation for every option." },
  { step: "Then", title: "Your training calendar", body: "Workout and rest days laid out by month. Tap a workout to change it or log it." },
  { step: "Then", title: "Log your sessions", body: "Sets, reps, accessories, how it felt and notes, exportable for review." },
];

export default async function DashboardPage() {
  // Every protected page checks the session itself; layouts alone are not enough.
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Hi, {user.displayName}</h1>
      <p className="mt-2 text-muted">Your account is ready. Here&apos;s what&apos;s being built next.</p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {COMING_UP.map((item) => (
          <li key={item.title} className="rounded-2xl border border-line bg-surface p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">{item.step}</span>
            <h2 className="mt-1 font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
