import "server-only";
import { prisma } from "@/lib/db";
import { formatShort, isDateStr } from "@/lib/dates";
import { LIFT_SLOTS, type LiftSlot } from "@/lib/training/five-three-one";
import { trainingMaxFromTestSet } from "@/lib/training/progress";
import { adviseAfterGap, moveDay, type DateStr, type DayChangeKind, type DayChanges } from "@/lib/training/schedule";
import type { TrainingMaxes } from "@/lib/training/programs/types";
import { dayChangeMap, firstPlanDay, lastTrainedDate, projectQueue, type CalendarData, type CalendarWorkout } from "./calendar";
import { applyLog } from "@/lib/log/store";
import type { WorkoutLog } from "@/lib/log/schema";
import type { Prisma } from "@/generated/prisma/client";
import { ensureQueue, getActivePlan, lowerMaxesAfterBreak, repeatLastWeek, saveTrainingMaxes, type ActivePlan } from "./store";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

/** Testing reps-in-reserve for the beginner test sets. */
const TEST_SET_RIR = 2;

export type TestSet = { weight: number; reps: number };

/** Everything the calendar needs: the planned queue and every finished or skipped workout. */
export async function loadCalendarData(userId: string, plan: ActivePlan): Promise<CalendarData> {
  const [queue, performed, dayChanges] = await Promise.all([
    prisma.workout.findMany({
      where: { enrollmentId: plan.enrollmentId, status: "PLANNED" },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true, phase: true, weekNumber: true },
    }),
    prisma.workout.findMany({
      where: { userId, status: { in: ["COMPLETED", "SKIPPED"] }, performedDate: { not: null } },
      orderBy: [{ performedDate: "asc" }, { sequence: "asc" }],
      select: { id: true, title: true, status: true, performedDate: true, phase: true, weekNumber: true },
    }),
    prisma.scheduleDay.findMany({
      where: { enrollmentId: plan.enrollmentId },
      orderBy: { date: "asc" },
      select: { date: true, kind: true },
    }),
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
    dayChanges,
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

/** Save the day changes for `dates` so they match `next`. */
async function saveDayChanges(tx: Prisma.TransactionClient, enrollmentId: string, dates: DateStr[], next: DayChanges) {
  await tx.scheduleDay.deleteMany({ where: { enrollmentId, date: { in: dates } } });
  const rows = dates.flatMap((date) => {
    const kind: DayChangeKind | undefined = next.get(date);
    return kind ? [{ enrollmentId, date, kind }] : [];
  });
  if (rows.length) await tx.scheduleDay.createMany({ data: rows });
}

/**
 * Move a planned workout to another day. The order of workouts never
 * changes: the day it was on stops being a training day, the new day becomes
 * one, and the workouts fill the training days in order.
 */
export async function moveWorkout(userId: string, workoutId: string, date: string): Promise<ActionResult> {
  if (!isDateStr(date)) return fail("Choose a day.");
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  const workout = ctx.projected.find((w) => w.id === workoutId);
  if (!workout) return fail("Only upcoming workouts can be moved.");
  const from = firstPlanDay(ctx.data);
  if (date < from) return fail(from === ctx.plan.today ? "Pick today or a later day." : `Your plan starts on ${formatShort(from)}. Pick that day or later.`);
  if (date === workout.date) return OK;
  if (ctx.data.performed.some((p) => p.performedDate === date)) return fail("You already have a finished workout that day.");

  const next = moveDay(dayChangeMap(ctx.data), workout.date, date, ctx.plan.trainingWeekdays);
  await prisma.$transaction((tx) => saveDayChanges(tx, ctx.plan.enrollmentId, [workout.date, date], next));
  return OK;
}

/** Undo every move from today on, so workouts go back to the usual training days. */
export async function restoreUsualDays(userId: string): Promise<ActionResult> {
  const plan = await getActivePlan(userId);
  if (!plan) return fail("Set up your plan first.");
  await prisma.scheduleDay.deleteMany({ where: { enrollmentId: plan.enrollmentId, date: { gte: plan.today } } });
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
  // Doing the next workout today when it was planned for a later day is
  // the same as moving it to today: the later day comes out of the schedule.
  const plannedFor = ctx.projected[0]?.id === workoutId ? ctx.projected[0].date : null;
  const movedToToday =
    opts.date === ctx.plan.today && plannedFor && plannedFor > ctx.plan.today
      ? moveDay(dayChangeMap(ctx.data), plannedFor, ctx.plan.today, ctx.plan.trainingWeekdays)
      : null;
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
        data: { status: "COMPLETED", performedDate: opts.date, completedAt: new Date() },
      });
      if (movedToToday && plannedFor) await saveDayChanges(tx, ctx.plan.enrollmentId, [plannedFor, ctx.plan.today], movedToToday);
    });
  } catch (e) {
    if (e instanceof LogError) return fail(e.message);
    throw e;
  }
  await ensureQueue(userId);
  return OK;
}

class LogError extends Error {}

/**
 * Skip the next workout. It isn't made up: the next training day gets the
 * workout after it, and so on. The training days themselves don't change.
 */
export async function skipWorkout(userId: string, workoutId: string): Promise<ActionResult> {
  const ctx = await context(userId);
  if (!ctx) return fail("Set up your plan first.");
  if (ctx.data.queue[0]?.id !== workoutId) return fail("Only the next workout can be skipped. Workouts are done in order.");
  await prisma.workout.update({
    where: { id: workoutId },
    data: { status: "SKIPPED", performedDate: ctx.plan.today },
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
      data: { status: "PLANNED", performedDate: null, completedAt: null },
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
