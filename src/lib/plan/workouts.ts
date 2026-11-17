import "server-only";
import { prisma } from "@/lib/db";
import { formatShort, isDateStr } from "@/lib/dates";
import { LIFT_SLOTS, type LiftSlot } from "@/lib/training/five-three-one";
import { trainingMaxFromTestSet } from "@/lib/training/progress";
import { adviseAfterGap } from "@/lib/training/schedule";
import type { TrainingMaxes } from "@/lib/training/programs/types";
import { lastTrainedDate, projectQueue, type CalendarData, type CalendarWorkout } from "./calendar";
import { applyLog } from "@/lib/log/store";
import type { WorkoutLog } from "@/lib/log/schema";
import { ensureQueue, getActivePlan, lowerMaxesAfterBreak, repeatLastWeek, saveTrainingMaxes, type ActivePlan } from "./store";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

/** Testing reps-in-reserve for the beginner test sets. */
const TEST_SET_RIR = 2;

export type TestSet = { weight: number; reps: number };

/** Everything the calendar needs: the planned queue and every finished or skipped workout. */
export async function loadCalendarData(userId: string, plan: ActivePlan): Promise<CalendarData> {
  const [queue, performed, checkIns] = await Promise.all([
    prisma.workout.findMany({
      where: { enrollmentId: plan.enrollmentId, status: "PLANNED" },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true, pinnedDate: true, phase: true, weekNumber: true },
    }),
    prisma.workout.findMany({
      where: { userId, status: { in: ["COMPLETED", "SKIPPED"] }, performedDate: { not: null } },
      orderBy: [{ performedDate: "asc" }, { sequence: "asc" }],
      select: { id: true, title: true, status: true, performedDate: true, phase: true, weekNumber: true },
    }),
    prisma.dayCheckIn.findMany({ where: { userId }, select: { date: true, feeling: true } }),
  ]);
  return {
    queue,
    performed: performed.map((p) => ({
      ...p,
      status: p.status as "COMPLETED" | "SKIPPED",
      performedDate: p.performedDate!,
    })),
    trainingWeekdays: plan.trainingWeekdays,
    today: plan.today,
    startDate: plan.startDate,
    checkIns: Object.fromEntries(checkIns.map((c) => [c.date, c.feeling])),
  };
}

async function context(userId: string) {
  const plan = await getActivePlan(userId);
  if (!plan) return null;
  const data = await loadCalendarData(userId, plan);
  return { plan, data, projected: projectQueue(data) };
}

/** Training maxes from test sets, for the lifts that have one. */
function testSetMaxes(plan: ActivePlan, sets: Partial<Record<LiftSlot, TestSet>>): TrainingMaxes {
  const out: TrainingMaxes = {};
  for (const { slot } of LIFT_SLOTS) {
    const set = sets[slot];
    if (set) out[slot] = trainingMaxFromTestSet(set.weight, set.reps, TEST_SET_RIR, plan.settings.trainingMaxPercent);
  }
  return out;
}

/** Move a planned workout to another day. Later workouts follow it if needed. */
export async function moveWorkout(userId: string, workoutId: string, date: string): Promise<ActionResult> {
  if (!isDateStr(date)) return fail("Choose a day.");
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  const index = ctx.data.queue.findIndex((q) => q.id === workoutId);
  const workout = ctx.projected.find((w) => w.id === workoutId);
  if (index < 0 || !workout) return fail("Only upcoming workouts can be moved.");
  if (date < workout.earliestMove!) {
    const previous = ctx.projected[ctx.projected.indexOf(workout) - 1];
    return fail(
      previous
        ? `Pick a day after ${previous.title} (${formatShort(previous.date)}). Workouts stay in order.`
        : "Pick today or a later day.",
    );
  }
  if (ctx.data.performed.some((p) => p.performedDate === date)) return fail("You already have a finished workout that day.");

  const laterPins = ctx.data.queue
    .slice(index + 1)
    .filter((q) => q.pinnedDate && q.pinnedDate <= date)
    .map((q) => q.id);
  await prisma.$transaction([
    prisma.workout.update({ where: { id: workoutId }, data: { pinnedDate: date } }),
    // A later workout can't stay on a day before this one.
    prisma.workout.updateMany({ where: { id: { in: laterPins } }, data: { pinnedDate: null } }),
  ]);
  return OK;
}

/** Let a workout go back to its automatic day. */
export async function unpinWorkout(userId: string, workoutId: string): Promise<ActionResult> {
  const ctx = await context(userId);
  if (!ctx?.data.queue.some((q) => q.id === workoutId)) return fail("Only upcoming workouts can be changed.");
  await prisma.workout.update({ where: { id: workoutId }, data: { pinnedDate: null } });
  return OK;
}

function latestPerformedDate(ctx: NonNullable<Awaited<ReturnType<typeof context>>>): string | null {
  return ctx.data.performed.map((p) => p.performedDate).sort().at(-1) ?? null;
}

/**
 * Mark the next workout as done, saving what was logged. On a test session
 * the logged main set of each lift becomes its training max.
 */
export async function completeWorkout(
  userId: string,
  workoutId: string,
  opts: { date: string; log?: WorkoutLog },
): Promise<ActionResult> {
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  const head = ctx.data.queue[0];
  if (!head || head.id !== workoutId) return fail("Finish or skip the earlier workouts first. Workouts are done in order.");
  if (!isDateStr(opts.date) || opts.date > ctx.plan.today) return fail("Pick today or an earlier day.");
  const latest = latestPerformedDate(ctx);
  if (latest && opts.date < latest) return fail(`Pick ${formatShort(latest)} or later, the day of your last workout.`);
  const slotOf = (slug: string) => LIFT_SLOTS.find(({ slot }) => ctx.plan.settings.variants[slot] === slug)?.slot;

  try {
    await prisma.$transaction(async (tx) => {
      if (opts.log) {
        const saved = await applyLog(tx, userId, workoutId, opts.log);
        if (!saved.ok) throw new LogError(saved.error);
      }
      const workout = await tx.workout.findUniqueOrThrow({
        where: { id: workoutId },
        include: { exercises: { where: { section: "MAIN" }, include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } } },
      });
      if (workout.phase === "find") {
        const recorded: Partial<Record<LiftSlot, TestSet>> = {};
        for (const e of workout.exercises) {
          const slot = slotOf(e.exercise.slug);
          // The heaviest logged set is the test set.
          const best = e.sets
            .filter((x) => x.actualWeight && x.actualReps)
            .sort((a, b) => b.actualWeight! - a.actualWeight!)[0];
          if (slot && best) recorded[slot] = { weight: best.actualWeight!, reps: Math.min(best.actualReps!, 15) };
        }
        await saveTrainingMaxes(tx, userId, ctx.plan.settings, testSetMaxes(ctx.plan, recorded), "TESTED", ctx.plan.today);
      }
      await tx.workout.update({
        where: { id: workoutId },
        data: { status: "COMPLETED", performedDate: opts.date, completedAt: new Date(), pinnedDate: null },
      });
    });
  } catch (e) {
    if (e instanceof LogError) return fail(e.message);
    throw e;
  }
  await ensureQueue(userId);
  return OK;
}

class LogError extends Error {}

/** Skip the next workout. It isn't made up; the one after it moves up. */
export async function skipWorkout(userId: string, workoutId: string): Promise<ActionResult> {
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  if (ctx.data.queue[0]?.id !== workoutId) return fail("Only the next workout can be skipped. Workouts are done in order.");
  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: "SKIPPED", performedDate: ctx.plan.today, pinnedDate: null },
  });
  await ensureQueue(userId);
  return OK;
}

/**
 * Undo the most recent done or skipped workout so it's next again. If
 * finishing it started a new cycle that hasn't been touched, that cycle (and
 * its raised training maxes) is rolled back too.
 */
export async function undoWorkout(userId: string, workoutId: string): Promise<ActionResult> {
  const plan = await getActivePlan(userId);
  if (!plan) return fail("Set up your plan first.");
  const latest = await prisma.workout.findFirst({
    where: { enrollmentId: plan.enrollmentId, status: { not: "PLANNED" } },
    orderBy: { sequence: "desc" },
  });
  if (!latest || latest.id !== workoutId) return fail("Only your most recent workout can be undone.");

  await prisma.$transaction(async (tx) => {
    const planned = await tx.workout.findMany({
      where: { enrollmentId: plan.enrollmentId, status: "PLANNED" },
      select: { id: true, cycleId: true },
    });
    const cycleIds = new Set(planned.map((w) => w.cycleId));
    const [onlyCycle] = [...cycleIds];
    if (cycleIds.size === 1 && onlyCycle && onlyCycle !== latest.cycleId) {
      const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: onlyCycle } });
      const touched = await tx.workout.count({ where: { cycleId: cycle.id, status: { not: "PLANNED" } } });
      if (touched === 0) {
        await tx.workout.deleteMany({ where: { cycleId: cycle.id } });
        await tx.trainingMax.deleteMany({ where: { userId, source: "PROGRESSION", createdAt: { gte: cycle.createdAt } } });
        await tx.cycle.delete({ where: { id: cycle.id } });
      }
    }
    await tx.workout.update({
      where: { id: workoutId },
      data: { status: "PLANNED", performedDate: null, completedAt: null, pinnedDate: null },
    });
  });
  return OK;
}

/** Training maxes for lifts the test sessions didn't cover (for example, a skipped test). */
export async function submitTestResults(userId: string, sets: Partial<Record<LiftSlot, TestSet>>): Promise<ActionResult> {
  const plan = await getActivePlan(userId);
  if (!plan) return fail("Set up your plan first.");
  const missing = LIFT_SLOTS.filter(({ slot }) => plan.trainingMaxes[slot] === undefined);
  for (const { slot, label } of missing) {
    if (!sets[slot]) return fail(`Enter a weight and reps for the ${label.toLowerCase()}.`);
  }
  const tms = testSetMaxes(plan, Object.fromEntries(missing.map(({ slot }) => [slot, sets[slot]])));
  await prisma.$transaction((tx) => saveTrainingMaxes(tx, userId, plan.settings, tms, "TESTED", plan.today));
  const status = await ensureQueue(userId);
  return status === "ok" ? OK : fail("Those weights are too light to plan with. Enter the weight you lifted for each.");
}

/** Start the next cycle if the queue ran out (normally automatic). */
export async function startNextCycle(userId: string): Promise<ActionResult> {
  const status = await ensureQueue(userId);
  if (status === "no-plan") return fail("Set up your plan first.");
  if (status === "needs-training-maxes") return fail("Enter your starting weights first.");
  return OK;
}

/** Act on the welcome-back advice after time away. */
export async function handleGap(userId: string, action: "continue" | "repeat-week" | "lower-training-max"): Promise<ActionResult> {
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  const last = lastTrainedDate(ctx.data.performed);
  const advice = adviseAfterGap(last, ctx.plan.today);
  if (advice.kind === "none") return OK;
  const option = advice.options.find((o) => o.action === action);
  if (!option) return fail("That option isn't available.");
  if (option.action === "lower-training-max" && option.reduceBy) await lowerMaxesAfterBreak(userId, option.reduceBy);
  if (option.action === "repeat-week") await repeatLastWeek(userId);
  await prisma.programEnrollment.update({ where: { id: ctx.plan.enrollmentId }, data: { gapHandledAfter: last } });
  return OK;
}

export type WorkoutContext = {
  /** Projected placement when the workout is planned. */
  projected: CalendarWorkout | null;
  /** The workout before it in the queue, if any. */
  previous: CalendarWorkout | null;
  isNext: boolean;
  /** The most recent done or skipped workout, which can be undone. */
  canUndo: boolean;
  today: string;
  /** Earliest day it can be marked done. */
  earliestDone: string | null;
};

export async function workoutContext(userId: string, workoutId: string): Promise<WorkoutContext | null> {
  const ctx = await context(userId);
  if (!ctx) return null;
  const i = ctx.projected.findIndex((w) => w.id === workoutId);
  const latest = await prisma.workout.findFirst({
    where: { enrollmentId: ctx.plan.enrollmentId, status: { not: "PLANNED" } },
    orderBy: { sequence: "desc" },
    select: { id: true },
  });
  return {
    projected: ctx.projected[i] ?? null,
    previous: i > 0 ? ctx.projected[i - 1] : null,
    isNext: ctx.data.queue[0]?.id === workoutId,
    canUndo: latest?.id === workoutId,
    today: ctx.plan.today,
    earliestDone: latestPerformedDate(ctx),
  };
}
