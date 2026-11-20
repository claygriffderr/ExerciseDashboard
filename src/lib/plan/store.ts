import "server-only";
import { prisma } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { syncExerciseCatalog } from "@/lib/training/catalog-sync";
import { LIFT_SLOTS, missedMinimumReps, type LiftSlot } from "@/lib/training/five-three-one";
import { getProgram } from "@/lib/training/programs";
import type { PlannedWorkout, ProgramDefinition, ProgramSettings, TrainingMaxes } from "@/lib/training/programs/types";
import { gearFromProfile } from "@/lib/training/profile-gear";
import { lowerTrainingMaxes, progressTrainingMaxes, type CycleOutcome } from "@/lib/training/progress";
import type { Gear } from "@/lib/training/equipment";
import type { Prisma } from "@/generated/prisma/client";
import { parseStoredSettings, type ExperienceLevel, type ValidatedPlan } from "./settings";

type Tx = Prisma.TransactionClient;

export type ActivePlan = {
  enrollmentId: string;
  program: ProgramDefinition;
  settings: ProgramSettings;
  startDate: string;
  gapHandledAfter: string | null;
  gear: Gear;
  trainingWeekdays: number[];
  timezone: string;
  today: string;
  trainingMaxes: TrainingMaxes;
  experienceLevel: ExperienceLevel;
  /** True once the main cycles have begun (the beginner intro is behind them). */
  mainPhaseStarted: boolean;
};

function parseWeekdays(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  } catch {
    return [];
  }
}

/** Slug → database id for every exercise in the catalog. */
async function exerciseIds(db: Tx | typeof prisma): Promise<Map<string, string>> {
  let rows = await db.exercise.findMany({ where: { ownerId: null }, select: { id: true, slug: true } });
  if (rows.length === 0) {
    await syncExerciseCatalog();
    rows = await db.exercise.findMany({ where: { ownerId: null }, select: { id: true, slug: true } });
  }
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** Append workouts to an enrollment's queue. */
async function insertWorkouts(
  tx: Tx,
  opts: {
    userId: string;
    enrollmentId: string;
    cycleId: string | null;
    startSequence: number;
    workouts: PlannedWorkout[];
  },
): Promise<number> {
  const ids = await exerciseIds(tx);
  let seq = opts.startSequence;
  for (const w of opts.workouts) {
    await tx.workout.create({
      data: {
        userId: opts.userId,
        enrollmentId: opts.enrollmentId,
        cycleId: opts.cycleId,
        sequence: seq++,
        phase: w.phase,
        templateKey: w.key,
        title: w.title,
        weekNumber: w.week,
        dayNumber: w.day,
        guidance: w.guidance ?? null,
        exercises: {
          create: w.exercises.map((e, order) => {
            const exerciseId = ids.get(e.exerciseSlug);
            if (!exerciseId) throw new Error(`Exercise not in database: ${e.exerciseSlug}`);
            return {
              exerciseId,
              section: e.section,
              order,
              notes: e.note ?? null,
              sets: {
                create: e.sets.map((s, i) => ({
                  setNumber: i + 1,
                  targetReps: s.reps,
                  targetRepsMax: s.repsMax ?? null,
                  targetPercent: s.percent ?? null,
                  targetWeight: s.weight,
                  targetRir: s.repsInReserve ?? null,
                  isAmrap: !!s.amrap,
                })),
              },
            };
          }),
        },
      },
    });
  }
  return seq;
}

async function nextSequence(tx: Tx, enrollmentId: string): Promise<number> {
  const agg = await tx.workout.aggregate({ where: { enrollmentId }, _max: { sequence: true } });
  return (agg._max.sequence ?? 0) + 1;
}

/** Latest training max per lift, for the exercises the plan uses. */
export async function currentTrainingMaxes(userId: string, settings: ProgramSettings, db: Tx | typeof prisma = prisma): Promise<TrainingMaxes> {
  const ids = await exerciseIds(db);
  const out: TrainingMaxes = {};
  for (const { slot } of LIFT_SLOTS) {
    const exerciseId = ids.get(settings.variants[slot]);
    if (!exerciseId) continue;
    const row = await db.trainingMax.findFirst({
      where: { userId, exerciseId },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      select: { trainingMax: true },
    });
    if (row) out[slot] = row.trainingMax;
  }
  return out;
}

export async function saveTrainingMaxes(
  tx: Tx,
  userId: string,
  settings: ProgramSettings,
  tms: TrainingMaxes,
  source: "TESTED" | "ESTIMATED" | "MANUAL" | "PROGRESSION",
  effectiveDate: string,
): Promise<void> {
  const ids = await exerciseIds(tx);
  for (const [slot, tm] of Object.entries(tms) as [LiftSlot, number][]) {
    const exerciseId = ids.get(settings.variants[slot]);
    if (!exerciseId || !(tm > 0)) continue;
    await tx.trainingMax.create({ data: { userId, exerciseId, trainingMax: tm, source, effectiveDate } });
  }
}

/** Start a new plan from onboarding answers. Ends any previous plan's remaining workouts. */
export async function createPlan(userId: string, plan: ValidatedPlan): Promise<void> {
  const { input, program, settings, trainingMaxes, runIntro } = plan;
  const today = todayIn(input.timezone);
  const gear = gearFromProfile({ barWeight: input.equipment.barWeight, availablePlates: JSON.stringify(input.equipment.plates) });

  await prisma.$transaction(async (tx) => {
    const old = await tx.programEnrollment.findMany({ where: { userId, status: "ACTIVE" }, select: { id: true } });
    for (const e of old) {
      await tx.workout.deleteMany({ where: { enrollmentId: e.id, status: "PLANNED" } });
      await tx.programEnrollment.update({ where: { id: e.id }, data: { status: "ENDED" } });
    }

    await tx.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    await tx.profile.update({
      where: { userId },
      data: {
        experienceLevel: input.experienceLevel,
        trainingDaysPerWeek: input.daysPerWeek,
        trainingWeekdays: JSON.stringify([...input.trainingWeekdays].sort()),
        barWeight: input.equipment.barWeight,
        availablePlates: JSON.stringify([...input.equipment.plates].sort((a, b) => b - a)),
        timezone: input.timezone,
        onboardingDoneAt: new Date(),
      },
    });

    const enrollment = await tx.programEnrollment.create({
      data: { userId, programKey: program.key, settings: JSON.stringify(settings), startDate: input.startDate },
    });

    if (!runIntro) {
      await saveTrainingMaxes(tx, userId, settings, trainingMaxes, input.startingWeights.mode === "enter" ? "ESTIMATED" : "MANUAL", today);
    }

    let seq = 1;
    if (runIntro) {
      seq = await insertWorkouts(tx, {
        userId,
        enrollmentId: enrollment.id,
        cycleId: null,
        startSequence: seq,
        workouts: program.buildIntro({ settings, gear }),
      });
    } else {
      const cycle = await tx.cycle.create({ data: { enrollmentId: enrollment.id, number: 1, startDate: input.startDate } });
      await insertWorkouts(tx, {
        userId,
        enrollmentId: enrollment.id,
        cycleId: cycle.id,
        startSequence: seq,
        workouts: program.buildCycle({ settings, trainingMaxes, gear, cycle: 1 }),
      });
    }
  });
}

export async function getActivePlan(userId: string): Promise<ActivePlan | null> {
  const [enrollment, profile] = await Promise.all([
    prisma.programEnrollment.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { cycles: true } } },
    }),
    prisma.profile.findUnique({ where: { userId } }),
  ]);
  if (!enrollment || !profile) return null;
  const program = getProgram(enrollment.programKey);
  if (!program) return null;
  const settings = parseStoredSettings(program, enrollment.settings);
  return {
    enrollmentId: enrollment.id,
    program,
    settings,
    startDate: enrollment.startDate,
    gapHandledAfter: enrollment.gapHandledAfter,
    gear: gearFromProfile(profile),
    trainingWeekdays: parseWeekdays(profile.trainingWeekdays),
    timezone: profile.timezone,
    today: todayIn(profile.timezone),
    trainingMaxes: await currentTrainingMaxes(userId, settings),
    experienceLevel: profile.experienceLevel,
    mainPhaseStarted: enrollment._count.cycles > 0,
  };
}

/** The latest training max for every exercise the person has one for, by slug. */
export async function knownTrainingMaxes(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.trainingMax.findMany({
    where: { userId },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
    select: { trainingMax: true, exercise: { select: { slug: true } } },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.exercise.slug] = r.trainingMax;
  return out;
}

/** Did the last cycle's main sets hit their reps? Unlogged sets count as hit. */
async function cycleOutcomes(tx: Tx, cycleId: string, settings: ProgramSettings): Promise<Partial<Record<LiftSlot, CycleOutcome>>> {
  const ids = await exerciseIds(tx);
  const slotByExercise = new Map(LIFT_SLOTS.map(({ slot }) => [ids.get(settings.variants[slot]), slot]));
  const sets = await tx.setEntry.findMany({
    where: {
      actualReps: { not: null },
      workoutExercise: { section: "MAIN", workout: { cycleId, status: "COMPLETED" } },
    },
    select: {
      actualReps: true,
      targetReps: true,
      isAmrap: true,
      workoutExercise: { select: { exerciseId: true, workout: { select: { weekNumber: true } } } },
    },
  });
  const out: Partial<Record<LiftSlot, CycleOutcome>> = {};
  for (const s of sets) {
    const slot = slotByExercise.get(s.workoutExercise.exerciseId);
    const week = s.workoutExercise.workout.weekNumber;
    if (!slot || !week || week > 3) continue;
    const missed = s.isAmrap
      ? missedMinimumReps(week as 1 | 2 | 3, s.actualReps!)
      : s.targetReps !== null && s.actualReps! < s.targetReps;
    if (missed) out[slot] = { missedReps: true };
  }
  return out;
}

export type QueueStatus = "ok" | "needs-training-maxes" | "no-plan";

/**
 * Keep the queue topped up: when the planned workouts run out, start the next
 * cycle (raising training maxes) or, after the beginner test week, ask for
 * the test results first.
 */
export async function ensureQueue(userId: string): Promise<QueueStatus> {
  const plan = await getActivePlan(userId);
  if (!plan) return "no-plan";
  return prisma.$transaction(async (tx) => {
    const planned = await tx.workout.count({ where: { enrollmentId: plan.enrollmentId, status: "PLANNED" } });
    if (planned > 0) return "ok";
    const cycles = await tx.cycle.findMany({ where: { enrollmentId: plan.enrollmentId }, orderBy: { number: "asc" } });
    const tms = await currentTrainingMaxes(userId, plan.settings, tx);
    const hasAll = LIFT_SLOTS.every(({ slot }) => tms[slot] !== undefined);
    if (!hasAll) return "needs-training-maxes";

    let nextTms = tms;
    const last = cycles.at(-1);
    if (last) {
      const outcomes = await cycleOutcomes(tx, last.id, plan.settings);
      nextTms = progressTrainingMaxes(tms, outcomes, plan.settings.increments).next;
    }
    const number = last ? last.number + 1 : 1;
    // Create the cycle first: undoing a workout rolls back training maxes saved after it.
    const cycle = await tx.cycle.create({ data: { enrollmentId: plan.enrollmentId, number, startDate: plan.today } });
    if (last) await saveTrainingMaxes(tx, userId, plan.settings, nextTms, "PROGRESSION", plan.today);
    await insertWorkouts(tx, {
      userId,
      enrollmentId: plan.enrollmentId,
      cycleId: cycle.id,
      startSequence: await nextSequence(tx, plan.enrollmentId),
      workouts: plan.program.buildCycle({ settings: plan.settings, trainingMaxes: nextTms, gear: plan.gear, cycle: number }),
    });
    return "ok";
  });
}

/** Template keys of repeated workouts end with this, so a rebuild leaves them alone. */
export const REPEAT_SUFFIX = ":repeat";

/**
 * Rebuild the planned (not yet done) workouts after the plan, training maxes
 * or equipment change, starting from where the person is now. Repeated
 * workouts (after time away) stay at the front as they are. Days the person
 * moved workouts to or from belong to the schedule, so they stay too.
 */
export async function rebuildPlannedQueue(userId: string): Promise<void> {
  const plan = await getActivePlan(userId);
  if (!plan) return;
  await prisma.$transaction(async (tx) => {
    const planned = await tx.workout.findMany({
      where: { enrollmentId: plan.enrollmentId, status: "PLANNED" },
      orderBy: { sequence: "asc" },
      include: { cycle: true },
    });
    const isRepeat = (key: string | null) => !!key?.endsWith(REPEAT_SUFFIX);
    const head = planned.find((w) => !isRepeat(w.templateKey));
    if (!head) return;
    const doneKeys = new Set(
      (
        await tx.workout.findMany({
          where: { enrollmentId: plan.enrollmentId, status: { not: "PLANNED" }, cycleId: head.cycleId },
          select: { templateKey: true },
        })
      ).map((w) => w.templateKey),
    );
    await tx.workout.deleteMany({ where: { id: { in: planned.filter((w) => !isRepeat(w.templateKey)).map((w) => w.id) } } });

    let rest: PlannedWorkout[];
    if (head.phase === "main" && head.cycle) {
      const tms = await currentTrainingMaxes(userId, plan.settings, tx);
      rest = plan.program
        .buildCycle({ settings: plan.settings, trainingMaxes: tms, gear: plan.gear, cycle: head.cycle.number })
        .filter((w) => w.week >= (head.weekNumber ?? 1) && !doneKeys.has(w.key));
    } else {
      const intro = plan.program.buildIntro({ settings: plan.settings, gear: plan.gear });
      const phaseOrder = plan.program.phases.map((p) => p.key);
      const headPhase = phaseOrder.indexOf(head.phase ?? "");
      rest = intro.filter((w) => {
        const phase = phaseOrder.indexOf(w.phase);
        if (phase < headPhase || doneKeys.has(w.key)) return false;
        return phase > headPhase || w.week >= (head.weekNumber ?? 1);
      });
    }
    await insertWorkouts(tx, {
      userId,
      enrollmentId: plan.enrollmentId,
      cycleId: head.cycleId,
      startSequence: await nextSequence(tx, plan.enrollmentId),
      workouts: rest,
    });
  });
}

/** Lower every training max after a long break and refresh planned weights. */
export async function lowerMaxesAfterBreak(userId: string, fraction: number): Promise<void> {
  const plan = await getActivePlan(userId);
  if (!plan) return;
  const lowered = lowerTrainingMaxes(plan.trainingMaxes, fraction);
  await prisma.$transaction((tx) => saveTrainingMaxes(tx, userId, plan.settings, lowered, "MANUAL", plan.today));
  await rebuildPlannedQueue(userId);
}

/**
 * Put copies of the last finished week in front of the queue, with the same
 * weights as before.
 */
export async function repeatLastWeek(userId: string): Promise<void> {
  const plan = await getActivePlan(userId);
  if (!plan) return;
  await prisma.$transaction(async (tx) => {
    const last = await tx.workout.findFirst({
      where: { enrollmentId: plan.enrollmentId, status: "COMPLETED" },
      orderBy: { sequence: "desc" },
    });
    if (!last) return;
    const week = await tx.workout.findMany({
      where: {
        enrollmentId: plan.enrollmentId,
        cycleId: last.cycleId,
        phase: last.phase,
        weekNumber: last.weekNumber,
        status: { not: "PLANNED" },
        NOT: { templateKey: { endsWith: REPEAT_SUFFIX } },
      },
      orderBy: { sequence: "asc" },
      include: { exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { setNumber: "asc" } } } } },
    });
    const planned = await tx.workout.findMany({
      where: { enrollmentId: plan.enrollmentId, status: "PLANNED" },
      orderBy: { sequence: "desc" },
      select: { id: true, sequence: true },
    });
    // Make room at the front of the queue: shift planned workouts back.
    const shift = week.length;
    for (const w of planned) {
      await tx.workout.update({ where: { id: w.id }, data: { sequence: (w.sequence ?? 0) + shift } });
    }
    let seq = (planned.at(-1)?.sequence ?? (await nextSequence(tx, plan.enrollmentId)));
    for (const w of week) {
      await tx.workout.create({
        data: {
          userId,
          enrollmentId: plan.enrollmentId,
          cycleId: w.cycleId,
          sequence: seq++,
          phase: w.phase,
          templateKey: `${w.templateKey ?? w.id}${REPEAT_SUFFIX}`,
          title: `${w.title.replace(/ \(repeat\)$/, "")} (repeat)`,
          weekNumber: w.weekNumber,
          dayNumber: w.dayNumber,
          guidance: w.guidance,
          exercises: {
            create: w.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              section: e.section,
              order: e.order,
              notes: e.notes,
              sets: {
                create: e.sets.map((set) => ({
                  setNumber: set.setNumber,
                  targetReps: set.targetReps,
                  targetRepsMax: set.targetRepsMax,
                  targetPercent: set.targetPercent,
                  targetWeight: set.targetWeight,
                  targetRir: set.targetRir,
                  isAmrap: set.isAmrap,
                })),
              },
            })),
          },
        },
      });
    }
  });
}

/**
 * Save changes from Settings. Switching programs starts a new plan; anything
 * else updates the current plan and refreshes the upcoming workouts.
 */
export async function updatePlan(userId: string, validated: ValidatedPlan): Promise<void> {
  const current = await getActivePlan(userId);
  if (!current || current.program.key !== validated.program.key) return createPlan(userId, validated);
  const { input, settings, trainingMaxes } = validated;
  const today = todayIn(input.timezone);
  const entered = input.startingWeights.mode === "enter";

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId },
      data: {
        experienceLevel: input.experienceLevel,
        trainingDaysPerWeek: input.daysPerWeek,
        trainingWeekdays: JSON.stringify([...input.trainingWeekdays].sort()),
        barWeight: input.equipment.barWeight,
        availablePlates: JSON.stringify([...input.equipment.plates].sort((a, b) => b - a)),
        timezone: input.timezone,
      },
    });
    await tx.programEnrollment.update({ where: { id: current.enrollmentId }, data: { settings: JSON.stringify(settings) } });
    if (entered) {
      const known = await currentTrainingMaxes(userId, settings, tx);
      const changed: TrainingMaxes = {};
      for (const [slot, tm] of Object.entries(trainingMaxes) as [LiftSlot, number][]) {
        if (known[slot] !== tm) changed[slot] = tm;
      }
      await saveTrainingMaxes(tx, userId, settings, changed, "MANUAL", today);
    }
  });

  const head = await prisma.workout.findFirst({
    where: { enrollmentId: current.enrollmentId, status: "PLANNED" },
    orderBy: { sequence: "asc" },
    select: { phase: true },
  });
  if (entered && head && head.phase !== "main") {
    // They know their numbers now, so skip the rest of the learning and test sessions.
    await prisma.workout.deleteMany({ where: { enrollmentId: current.enrollmentId, status: "PLANNED" } });
  } else {
    await rebuildPlannedQueue(userId);
  }
  await ensureQueue(userId);
}
