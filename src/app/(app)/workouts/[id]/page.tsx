import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { relativeDay, workoutLabel } from "@/lib/plan/describe";
import { getActivePlan } from "@/lib/plan/store";
import { workoutContext } from "@/lib/plan/workouts";
import { weightIsPerHand } from "@/lib/training/exercises";
import { exerciseLibrary } from "@/lib/log/store";
import type { Feeling } from "@/lib/log/schema";
import { parseRestSettings } from "@/lib/log/rest";
import { getProgram } from "@/lib/training/programs";
import { WorkoutSession, type ExerciseDraft } from "./workout-session";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const workout = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: {
      enrollment: { select: { programKey: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { select: { id: true, slug: true, name: true, equipment: true, ownerId: true } }, sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  if (!workout) notFound();

  const program = workout.enrollment ? (getProgram(workout.enrollment.programKey) ?? null) : null;
  const plan = await getActivePlan(user.id);
  const active = !!plan && plan.enrollmentId === workout.enrollmentId;
  const ctx = active ? await workoutContext(user.id, workout.id) : null;
  const today = plan?.today ?? new Date().toISOString().slice(0, 10);

  const [library, profile] = await Promise.all([
    exerciseLibrary(user.id),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { restTimer: true } }),
  ]);
  const str = (n: number | null) => (n === null ? "" : String(n));
  const exercises: ExerciseDraft[] = workout.exercises.map((e) => ({
    key: e.id,
    id: e.id,
    exerciseId: e.exercise.id,
    name: e.exercise.name,
    slug: e.exercise.ownerId ? null : e.exercise.slug,
    section: e.section,
    note: e.notes,
    perHand: weightIsPerHand(e.exercise.slug) || (!!e.exercise.ownerId && e.exercise.equipment === "dumbbell"),
    rir: e.sets[0]?.targetRir ?? null,
    sets: e.sets.map((s) => ({
      key: s.id,
      id: s.id,
      target:
        s.targetReps === null && s.targetWeight === null
          ? null
          : { reps: s.targetReps, repsMax: s.targetRepsMax, weight: s.targetWeight, amrap: s.isAmrap, percent: s.targetPercent },
      weight: str(s.actualWeight),
      reps: str(s.actualReps),
      done: s.completed,
    })),
  }));

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
            {ctx?.projected?.moved && <span className="text-muted">You moved a workout to this day.</span>}
          </p>
        </div>
      </div>

      <WorkoutSession
        workoutId={workout.id}
        status={workout.status}
        phase={workout.phase}
        guidance={workout.guidance}
        exercises={exercises}
        feeling={(workout.feeling as Feeling | null) ?? null}
        notes={workout.notes ?? ""}
        library={library}
        rest={parseRestSettings(profile?.restTimer)}
        plan={
          ctx
            ? {
                isNext: ctx.isNext,
                canUndo: ctx.canUndo,
                today: ctx.today,
                earliestDone: ctx.earliestDone,
                projectedDate: ctx.projected?.date ?? null,
                earliestMove: ctx.projected?.earliestMove ?? null,
                previous: ctx.previous ? { title: ctx.previous.title, date: ctx.previous.date } : null,
              }
            : null
        }
      />
    </div>
  );
}
