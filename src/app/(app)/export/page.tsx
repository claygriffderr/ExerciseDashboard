import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { AI_PROMPT } from "@/lib/log/export";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Export" };

const SAMPLE = `{
  "date": "2026-11-16",
  "status": "completed",
  "title": "Squat day",
  "feeling": "Felt great!",
  "notes": "Slept well. Last set moved fast.",
  "exercises": [
    {
      "name": "Back squat",
      "section": "main",
      "sets": [
        { "set": 3, "planned": { "reps": 5, "weight": 195,
            "percentOfTrainingMax": 85, "asManyAsPossible": true },
          "done": { "weight": 195, "reps": 9 }, "completed": true }
      ]
    }
  ]
}`;

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export default async function ExportPage() {
  const user = await requireUser();
  const [done, skipped, first] = await Promise.all([
    prisma.workout.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.workout.count({ where: { userId: user.id, status: "SKIPPED" } }),
    prisma.workout.findFirst({
      where: { userId: user.id, status: { in: ["COMPLETED", "SKIPPED"] }, performedDate: { not: null } },
      orderBy: { performedDate: "asc" },
      select: { performedDate: true },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Export your history</h1>
      <p className="mt-2 text-muted">
        Download every workout you&apos;ve finished or skipped as a JSON file: dates, planned and logged sets, how each session
        felt, and your notes. It&apos;s written to make sense on its own, so you can hand it to an AI assistant to look for
        patterns, or keep it as a backup.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Download</h2>
        <p className="mt-1 text-sm text-muted">
          {done + skipped === 0
            ? "Nothing to export yet. Finish a workout first."
            : `${done} finished and ${skipped} skipped workouts so far${first?.performedDate ? `, since ${first.performedDate}` : ""}.`}{" "}
          Leave the dates empty to export everything.
        </p>
        <form action="/api/export" method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-muted">From</span>
            <input type="date" name="from" className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">To</span>
            <input type="date" name="to" className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
          >
            Download JSON
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          The file includes your training data but not your name or email. Your notes are included as you wrote them.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Asking an AI to review it</h2>
          <CopyButton text={AI_PROMPT} label="Copy prompt" />
        </div>
        <p className="mt-1 text-sm text-muted">Attach the file and paste this as a starting point:</p>
        <blockquote className="mt-3 rounded-lg border-l-4 border-accent bg-accent/5 p-3 text-sm leading-6 text-ink">{AI_PROMPT}</blockquote>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">What a workout looks like in the file</h2>
        <p className="mt-1 text-sm text-muted">
          The file also has your current plan, training max history and a short explanation of every field.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs leading-5 text-ink">{SAMPLE}</pre>
      </section>
    </div>
  );
}
