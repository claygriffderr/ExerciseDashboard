import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { formatMonth } from "@/lib/dates";
import { buildMonth, lastTrainedDate, monthOf, projectQueue, shiftMonth } from "@/lib/plan/calendar";
import { relativeDay, workoutLabel } from "@/lib/plan/describe";
import { getActivePlan } from "@/lib/plan/store";
import { loadCalendarData } from "@/lib/plan/workouts";
import { getExercise, weightIsPerHand } from "@/lib/training/exercises";
import { LIFT_SLOTS } from "@/lib/training/five-three-one";
import { adviseAfterGap } from "@/lib/training/schedule";
import { CalendarView } from "./calendar-view";
import { GapAdvice, StartCycleButton, TestResultsForm } from "./plan-panels";

export const metadata: Metadata = { title: "Calendar" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const plan = await getActivePlan(user.id);

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Your training calendar</h1>
        <p className="mt-3 text-muted">
          Set up your program first. It takes about five minutes, and every choice is explained along the way.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
        >
          Set up my program
        </Link>
      </div>
    );
  }

  const { month: monthParam } = await searchParams;
  const thisMonth = monthOf(plan.today);
  const month = typeof monthParam === "string" && MONTH_RE.test(monthParam) ? monthParam : thisMonth;
  const data = await loadCalendarData(user.id, plan);
  const projected = projectQueue(data);
  const weeks = buildMonth(month, data, projected);
  const next = projected[0];

  const missingMaxes = LIFT_SLOTS.filter(({ slot }) => plan.trainingMaxes[slot] === undefined);
  const queueEmpty = data.queue.length === 0;
  const lastTrained = lastTrainedDate(data.performed);
  const advice = adviseAfterGap(lastTrained, plan.today);
  const showAdvice = advice.kind !== "none" && !queueEmpty && plan.gapHandledAfter !== lastTrained ? advice : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{plan.program.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{formatMonth(month)}</h1>
        </div>
        <nav aria-label="Month" className="flex items-center gap-2 text-sm">
          <Link
            href={`/calendar?month=${shiftMonth(month, -1)}`}
            className="rounded-lg border border-line px-3 py-2 font-medium text-ink hover:bg-line/40"
            aria-label="Previous month"
          >
            ←
          </Link>
          {month !== thisMonth && (
            <Link href="/calendar" className="rounded-lg border border-line px-3 py-2 font-medium text-ink hover:bg-line/40">
              This month
            </Link>
          )}
          <Link
            href={`/calendar?month=${shiftMonth(month, 1)}`}
            className="rounded-lg border border-line px-3 py-2 font-medium text-ink hover:bg-line/40"
            aria-label="Next month"
          >
            →
          </Link>
        </nav>
      </div>

      {showAdvice && <GapAdvice message={showAdvice.message} options={showAdvice.options} />}

      {queueEmpty && missingMaxes.length > 0 && (
        <TestResultsForm
          lifts={missingMaxes.map(({ slot }) => {
            const ex = getExercise(plan.settings.variants[slot]);
            return { slot, name: ex.name, perHand: weightIsPerHand(ex.slug) };
          })}
        />
      )}
      {queueEmpty && missingMaxes.length === 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">Ready for the next cycle</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Your training maxes go up a little, and the next weeks are planned.</p>
          <StartCycleButton />
        </section>
      )}

      {next && (
        <section aria-labelledby="next-title" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <p className="text-sm font-medium text-muted">Next workout · {relativeDay(next.date, plan.today)}</p>
            <h2 id="next-title" className="mt-0.5 text-xl font-semibold text-ink">
              {next.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{workoutLabel(plan.program, next.phase, next.weekNumber)}</p>
          </div>
          <Link
            href={`/workouts/${next.id}`}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
          >
            Open workout
          </Link>
        </section>
      )}

      <CalendarView weeks={weeks} today={plan.today} startDate={plan.startDate} />
    </div>
  );
}
