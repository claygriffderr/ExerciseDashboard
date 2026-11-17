import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { projectQueue } from "@/lib/plan/calendar";
import { relativeDay, workoutLabel } from "@/lib/plan/describe";
import { getActivePlan } from "@/lib/plan/store";
import { loadCalendarData } from "@/lib/plan/workouts";
import { canCheckIn, checkInDayKind } from "@/lib/log/checkin";
import { weekday } from "@/lib/training/schedule";
import { QuickCheckIn } from "./quick-check-in";

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

export default async function DashboardPage() {
  // Every protected page checks the session itself; layouts alone are not enough.
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const data = plan ? await loadCalendarData(user.id, plan) : null;
  const upcoming = data ? projectQueue(data).slice(0, 3) : [];
  const next = upcoming[0];

  // A day without a workout to do gets a quick "how are you feeling?" check-in.
  const todayKind =
    plan && data
      ? checkInDayKind({
          date: plan.today,
          today: plan.today,
          isTrainingDay: plan.trainingWeekdays.includes(weekday(plan.today)),
          startDate: plan.startDate,
          workouts: [
            ...data.performed.filter((p) => p.performedDate === plan.today),
            ...upcoming.filter((w) => w.date === plan.today),
          ],
        })
      : null;
  const showCheckIn = !!todayKind && canCheckIn(todayKind);
  const isTrainingToday = !!plan && plan.trainingWeekdays.includes(weekday(plan.today));

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Hi, {user.displayName}</h1>

      {!plan && (
        <section className="mt-6 rounded-2xl border border-accent/40 bg-accent/5 p-6">
          <h2 className="text-xl font-semibold text-ink">Set up your program</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Answer a few questions about your experience, schedule and equipment, with every choice explained. You&apos;ll
            get a calendar of workouts made for you.
          </p>
          <Link
            href="/onboarding"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
          >
            Get started
          </Link>
        </section>
      )}

      {plan && showCheckIn && (
        <QuickCheckIn
          date={plan.today}
          heading={todayKind === "skipped" ? "Workout skipped today." : isTrainingToday ? "No workout today." : "Rest day."}
          initial={data?.checkIns?.[plan.today] ?? null}
        />
      )}

      {plan && (
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-line bg-surface p-6">
            {next ? (
              <>
                <p className="text-sm font-medium text-muted">Next workout · {relativeDay(next.date, plan.today)}</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{next.title}</h2>
                <p className="mt-1 text-sm text-muted">{workoutLabel(plan.program, next.phase, next.weekNumber)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/workouts/${next.id}`}
                    className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
                  >
                    Open workout
                  </Link>
                  <Link href="/calendar" className="rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-line/40">
                    Calendar
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-ink">Nothing planned yet</h2>
                <p className="mt-1 text-sm text-muted">Open the calendar to finish setting up your next workouts.</p>
                <Link
                  href="/calendar"
                  className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
                >
                  Open the calendar
                </Link>
              </>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-semibold text-ink">{plan.program.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Training {plan.trainingWeekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}
            </p>
            {upcoming.length > 1 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-ink">Coming up</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {upcoming.slice(1).map((w) => (
                    <li key={w.id}>
                      {relativeDay(w.date, plan.today)}: {w.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link href="/settings" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
              Change your plan
            </Link>
          </section>
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        The <span className="font-medium text-ink">Plates</span> button in the corner works on every page.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {EXPLORE.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block h-full rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/60 hover:shadow-sm">
              <h2 className="font-semibold text-ink">{item.title} →</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
