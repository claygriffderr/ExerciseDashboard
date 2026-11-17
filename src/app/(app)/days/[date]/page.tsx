import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { formatLong, isDateStr } from "@/lib/dates";
import { canCheckIn, checkInDayKind, CHECK_IN_TAG_LABELS, FEELING_SHORT, type DayKind } from "@/lib/log/checkin";
import { getCheckIn, userToday } from "@/lib/log/checkin-store";
import { FEELING_LABELS } from "@/lib/log/schema";
import { projectQueue } from "@/lib/plan/calendar";
import { relativeDay } from "@/lib/plan/describe";
import { getActivePlan } from "@/lib/plan/store";
import { loadCalendarData } from "@/lib/plan/workouts";
import { weekday } from "@/lib/training/schedule";
import { CheckInForm } from "./check-in-form";

export const metadata: Metadata = { title: "Check-in" };

const HEADINGS: Record<DayKind, string> = {
  rest: "Rest day",
  missed: "Missed training day",
  skipped: "Skipped workout",
  trained: "Workout day",
  planned: "Workout day",
  future: "Rest day",
};

export default async function DayPage({ params }: PageProps<"/days/[date]">) {
  const user = await requireUser();
  const { date } = await params;
  if (!isDateStr(date)) notFound();

  const plan = await getActivePlan(user.id);
  const today = plan?.today ?? (await userToday(user.id));

  const [performed, checkIn, planned] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id, performedDate: date, status: { in: ["COMPLETED", "SKIPPED"] } },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true, status: true },
    }),
    getCheckIn(user.id, date),
    plan && date >= today
      ? loadCalendarData(user.id, plan).then((data) => projectQueue(data).filter((w) => w.date === date))
      : Promise.resolve([]),
  ]);
  const workouts = [
    ...performed.map((w) => ({ id: w.id, title: w.title, status: w.status as "COMPLETED" | "SKIPPED" })),
    ...planned.map((w) => ({ id: w.id, title: w.title, status: "PLANNED" as const })),
  ];

  const isTrainingDay = !!plan && plan.trainingWeekdays.includes(weekday(date));
  const kind = checkInDayKind({ date, today, isTrainingDay, startDate: plan?.startDate ?? null, workouts });
  const heading = kind === "future" && isTrainingDay ? "Training day" : HEADINGS[kind];
  const rel = relativeDay(date, today);

  return (
    <div className="max-w-2xl">
      <Link href={`/calendar?month=${date.slice(0, 7)}`} className="text-sm font-medium text-accent hover:underline">
        ← Calendar
      </Link>
      <p className="mt-3 text-sm font-medium text-muted">{rel === formatLong(date) ? rel : `${rel} · ${formatLong(date)}`}</p>
      <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">{heading}</h1>

      {kind === "missed" && (
        <p className="mt-2 text-muted">
          No problem. Your next workout picks up right where you left off, so nothing in your program is lost.
        </p>
      )}
      {kind === "rest" && (
        <p className="mt-2 text-muted">
          Rest days are when your muscles recover and get stronger. A quick note on how you feel helps you spot patterns later.
        </p>
      )}

      {workouts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link href={`/workouts/${w.id}`} className="font-medium text-accent hover:underline">
                {w.title}
              </Link>
              <span className="text-sm text-muted">
                {" "}
                · {w.status === "COMPLETED" ? "done" : w.status === "SKIPPED" ? "skipped" : "planned"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {canCheckIn(kind) ? (
          <CheckInForm date={date} isToday={date === today} initial={checkIn} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-5 text-muted">
            {kind === "future" && <p>Check-ins open on the day itself. Come back then to note how you feel.</p>}
            {kind === "trained" && <p>You finished a workout this day, so how you felt is in its log.</p>}
            {kind === "planned" && <p>You have a workout planned today. After it, rate how it felt in the workout log.</p>}
            {checkIn && (
              <div className="mt-4 border-t border-line pt-4 text-ink">
                <p className="text-sm font-semibold">Your earlier check-in</p>
                {checkIn.feeling && (
                  <p className="mt-1">
                    <span aria-hidden>{FEELING_LABELS[checkIn.feeling].emoji}</span> {FEELING_SHORT[checkIn.feeling]}
                  </p>
                )}
                {checkIn.tags.length > 0 && <p className="mt-1 text-sm text-muted">{checkIn.tags.map((t) => CHECK_IN_TAG_LABELS[t]).join(", ")}</p>}
                {checkIn.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{checkIn.notes}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
