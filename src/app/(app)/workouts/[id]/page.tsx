import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutCard } from "@/components/workout-card";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { relativeDay, workoutLabel } from "@/lib/plan/describe";
import { getActivePlan } from "@/lib/plan/store";
import { workoutContext } from "@/lib/plan/workouts";
import { weightIsPerHand } from "@/lib/training/exercises";
import { LIFT_SLOTS } from "@/lib/training/five-three-one";
import { getProgram } from "@/lib/training/programs";
import type { PlannedWorkout } from "@/lib/training/programs/types";
import { WorkoutActions, type TestLift } from "./workout-actions";

export const metadata: Metadata = { title: "Workout" };

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

export default async function WorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const workout = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: {
      enrollment: { select: { programKey: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { select: { slug: true, name: true, equipment: true } }, sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  if (!workout) notFound();

  const program = workout.enrollment ? (getProgram(workout.enrollment.programKey) ?? null) : null;
  const plan = await getActivePlan(user.id);
  const active = !!plan && plan.enrollmentId === workout.enrollmentId;
  const ctx = active ? await workoutContext(user.id, workout.id) : null;
  const today = plan?.today ?? new Date().toISOString().slice(0, 10);

  const planned: PlannedWorkout = {
    key: workout.templateKey ?? workout.id,
    title: workout.title,
    phase: workout.phase ?? "",
    week: workout.weekNumber ?? 1,
    day: workout.dayNumber ?? 1,
    guidance: workout.guidance ?? undefined,
    exercises: workout.exercises.map((e) => ({
      exerciseSlug: e.exercise.slug,
      section: e.section,
      ...(e.notes ? { note: e.notes } : {}),
      sets: e.sets.map((s) => ({
        reps: s.targetReps ?? 0,
        ...(s.targetRepsMax ? { repsMax: s.targetRepsMax } : {}),
        ...(s.targetPercent ? { percent: s.targetPercent } : {}),
        weight: s.targetWeight,
        ...(s.isAmrap ? { amrap: true } : {}),
        ...(s.targetRir !== null ? { repsInReserve: s.targetRir } : {}),
      })),
    })),
  };

  // Test sessions record one test set per main lift.
  const testLifts: TestLift[] = [];
  const recordedTests: { name: string; weight: number; reps: number }[] = [];
  if (workout.phase === "find") {
    for (const e of workout.exercises.filter((x) => x.section === "MAIN")) {
      const slot = plan ? LIFT_SLOTS.find(({ slot }) => plan.settings.variants[slot] === e.exercise.slug)?.slot : undefined;
      if (slot) testLifts.push({ slot, name: e.exercise.name, perHand: weightIsPerHand(e.exercise.slug) });
      const set = e.sets.at(-1);
      if (set?.actualWeight && set.actualReps) recordedTests.push({ name: e.exercise.name, weight: set.actualWeight, reps: set.actualReps });
    }
  }

  const date = workout.status === "PLANNED" ? (ctx?.projected?.date ?? null) : workout.performedDate;
  const rel = date ? relativeDay(date, today) : null;
  const relInSentence = rel === null ? "" : ["Today", "Tomorrow", "Yesterday"].includes(rel) ? ` ${rel.toLowerCase()}` : ` on ${rel}`;
  const when =
    workout.status === "COMPLETED"
      ? `Done${relInSentence}`
      : workout.status === "SKIPPED"
        ? `Skipped${relInSentence}`
        : rel
          ? `${ctx?.isNext ? "Next up" : "Planned"} · ${rel}`
          : "Planned";

  return (
    <div>
      <Link href={date ? `/calendar?month=${date.slice(0, 7)}` : "/calendar"} className="text-sm font-medium text-accent hover:underline">
        ← Calendar
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{workoutLabel(program, workout.phase, workout.weekNumber)}</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">{workout.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                workout.status === "COMPLETED"
                  ? "bg-success/15 text-success"
                  : workout.status === "SKIPPED"
                    ? "bg-line text-muted"
                    : "bg-accent/15 text-accent-strong"
              }`}
            >
              {when}
            </span>
            {ctx?.projected?.pinned && <span className="text-muted">You moved it to this day.</span>}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <WorkoutCard workout={planned} showTitle={false} />
          {recordedTests.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="font-semibold text-ink">Your test sets</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {recordedTests.map((t) => (
                  <li key={t.name}>
                    {t.name}: {fmt(t.weight)} lb × {t.reps}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div>
          {ctx ? (
            <WorkoutActions
              workoutId={workout.id}
              status={workout.status}
              isNext={ctx.isNext}
              canUndo={ctx.canUndo}
              today={ctx.today}
              earliestDone={ctx.earliestDone}
              projectedDate={ctx.projected?.date ?? null}
              earliestMove={ctx.projected?.earliestMove ?? null}
              pinned={ctx.projected?.pinned ?? false}
              previous={ctx.previous ? { title: ctx.previous.title, date: ctx.previous.date } : null}
              testLifts={workout.status === "PLANNED" ? testLifts : []}
            />
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">This workout is from an earlier plan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
