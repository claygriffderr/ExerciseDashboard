import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { MUSCLE_LABELS, type Muscle } from "@/lib/training/muscles";
import { WEEKDAY_NAMES } from "@/lib/dates";
import { getActivePlan } from "@/lib/plan/store";
import { EXERCISE_BY_SLUG } from "@/lib/training/exercises";
import { LIFT_SLOTS } from "@/lib/training/five-three-one";
import { getProgram } from "@/lib/training/programs";
import type { ExportInput } from "./export";
import { resolveSet, type CustomExerciseInput, type LibraryExercise, type WorkoutLog } from "./schema";

type Tx = Prisma.TransactionClient;
export type LogResult = { ok: true } | { ok: false; error: string };

function parseMuscles(json: string): Muscle[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((m): m is Muscle => typeof m === "string" && m in MUSCLE_LABELS) : [];
  } catch {
    return [];
  }
}

/** Built-in exercises plus the person's own, for the accessory picker. */
export async function exerciseLibrary(userId: string): Promise<LibraryExercise[]> {
  const rows = await prisma.exercise.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, pattern: true, equipment: true, primaryMuscles: true, ownerId: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    pattern: r.pattern,
    equipment: r.equipment,
    primary: parseMuscles(r.primaryMuscles),
    custom: r.ownerId !== null,
  }));
}

export async function createCustomExercise(userId: string, input: CustomExerciseInput): Promise<LibraryExercise> {
  const primary = input.primaryMuscles.filter((m): m is Muscle => m in MUSCLE_LABELS);
  const row = await prisma.exercise.create({
    data: {
      slug: `custom-${randomBytes(9).toString("base64url")}`,
      name: input.name,
      category: "ACCESSORY",
      pattern: input.pattern,
      equipment: input.equipment,
      primaryMuscles: JSON.stringify(primary),
      description: input.description,
      ownerId: userId,
    },
  });
  return { id: row.id, name: row.name, pattern: row.pattern, equipment: row.equipment, primary, custom: true };
}

/**
 * Save what the person logged: set weights and reps, added or removed
 * accessories and extra sets, how it felt and notes. Planned sets keep their
 * targets; only sets the person added can be removed.
 */
export async function applyLog(tx: Tx, userId: string, workoutId: string, log: WorkoutLog): Promise<LogResult> {
  const workout = await tx.workout.findFirst({
    where: { id: workoutId, userId },
    include: { exercises: { include: { sets: true } } },
  });
  if (!workout) return { ok: false, error: "Workout not found." };

  const existing = new Map(workout.exercises.map((e) => [e.id, e]));
  const keep = new Set(log.exercises.map((e) => e.id).filter(Boolean));
  const newIds = log.exercises.filter((e) => !e.id).map((e) => e.exerciseId!);
  if (log.exercises.some((e) => !e.id && !e.exerciseId) || log.exercises.some((e) => e.id && !existing.has(e.id))) {
    return { ok: false, error: "This workout changed in another tab. Reload the page and try again." };
  }
  const stale = log.exercises.some(
    (e) => e.id && e.sets.some((set) => set.id && !existing.get(e.id!)!.sets.some((x) => x.id === set.id)),
  );
  if (stale) return { ok: false, error: "This workout changed in another tab. Reload the page and try again." };
  if (newIds.length) {
    const allowed = await tx.exercise.count({ where: { id: { in: newIds }, OR: [{ ownerId: null }, { ownerId: userId }] } });
    if (allowed !== new Set(newIds).size) return { ok: false, error: "That exercise isn't available." };
  }

  // Removed exercises: only assistance work can go; planned main and volume work stays.
  for (const e of workout.exercises) {
    if (!keep.has(e.id) && e.section === "ACCESSORY") await tx.workoutExercise.delete({ where: { id: e.id } });
  }

  let order = 0;
  for (const entry of log.exercises) {
    if (entry.id) {
      const current = existing.get(entry.id)!;
      const byId = new Map(current.sets.map((s) => [s.id, s]));
      const sent = new Set(entry.sets.map((s) => s.id).filter(Boolean));
      for (const s of current.sets) {
        const added = s.targetReps === null && s.targetWeight === null;
        if (!sent.has(s.id) && added) await tx.setEntry.delete({ where: { id: s.id } });
      }
      let setNumber = 1;
      for (const set of entry.sets) {
        const prev = set.id ? byId.get(set.id) : undefined;
        const target = prev
          ? { reps: prev.targetReps, repsMax: prev.targetRepsMax, weight: prev.targetWeight, amrap: prev.isAmrap, percent: prev.targetPercent }
          : null;
        const s = resolveSet(set, target);
        const data = { setNumber: setNumber++, actualWeight: s.weight, actualReps: s.reps, completed: s.done };
        if (prev) await tx.setEntry.update({ where: { id: prev.id }, data });
        else await tx.setEntry.create({ data: { ...data, workoutExerciseId: current.id } });
      }
      await tx.workoutExercise.update({ where: { id: current.id }, data: { order: order++ } });
    } else {
      await tx.workoutExercise.create({
        data: {
          workoutId,
          exerciseId: entry.exerciseId!,
          section: "ACCESSORY",
          order: order++,
          sets: {
            create: entry.sets.map((s, i) => ({
              setNumber: i + 1,
              actualWeight: s.weight,
              actualReps: s.reps,
              completed: s.done,
            })),
          },
        },
      });
    }
  }
  // Anything not sent (planned exercises the page didn't show) goes to the end in its old order.
  for (const e of workout.exercises.filter((x) => !keep.has(x.id) && x.section !== "ACCESSORY").sort((a, b) => a.order - b.order)) {
    await tx.workoutExercise.update({ where: { id: e.id }, data: { order: order++ } });
  }

  await tx.workout.update({
    where: { id: workoutId },
    data: { feeling: log.feeling, notes: log.notes.trim() ? log.notes.trim() : null },
  });
  return { ok: true };
}

export async function saveWorkoutLog(userId: string, workoutId: string, log: WorkoutLog): Promise<LogResult> {
  return prisma.$transaction((tx) => applyLog(tx, userId, workoutId, log));
}

/** Everything the JSON export needs, for one person, optionally within dates. */
export async function loadExportInput(userId: string, range: { from: string | null; to: string | null }): Promise<ExportInput> {
  const dateFilter = {
    not: null,
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
  const [rows, tmRows, plan] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, status: { in: ["COMPLETED", "SKIPPED"] }, performedDate: dateFilter },
      orderBy: [{ performedDate: "asc" }, { sequence: "asc" }],
      include: {
        enrollment: { select: { programKey: true } },
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: { select: { name: true, ownerId: true, equipment: true, primaryMuscles: true } },
            sets: { orderBy: { setNumber: "asc" } },
          },
        },
      },
    }),
    prisma.trainingMax.findMany({
      where: {
        userId,
        effectiveDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) },
      },
      orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
      select: { effectiveDate: true, trainingMax: true, source: true, exercise: { select: { name: true } } },
    }),
    getActivePlan(userId),
  ]);

  const choices: Record<string, string> = {};
  if (plan) {
    for (const o of plan.program.options) {
      if (o.showWhen && !o.showWhen(plan.settings)) continue;
      const value = plan.settings[o.key];
      choices[o.label] = o.choices.find((c) => c.value === value)?.label ?? String(value);
    }
  }

  return {
    exportedAt: new Date(),
    from: range.from,
    to: range.to,
    plan: plan
      ? {
          program: plan.program.name,
          startDate: plan.startDate,
          trainingDays: plan.trainingWeekdays.map((d) => WEEKDAY_NAMES[d]),
          choices,
          lifts: Object.fromEntries(LIFT_SLOTS.map(({ slot, label }) => [label, EXERCISE_BY_SLUG.get(plan.settings.variants[slot])?.name ?? slot])),
          trainingMaxes: LIFT_SLOTS.filter(({ slot }) => plan.trainingMaxes[slot] !== undefined).map(({ slot, label }) => ({
            lift: label,
            exercise: EXERCISE_BY_SLUG.get(plan.settings.variants[slot])?.name ?? slot,
            trainingMax: plan.trainingMaxes[slot]!,
          })),
        }
      : null,
    trainingMaxHistory: tmRows.map((t) => ({
      date: t.effectiveDate,
      exercise: t.exercise.name,
      trainingMax: t.trainingMax,
      source: t.source.toLowerCase(),
    })),
    workouts: rows.map((w) => ({
      performedDate: w.performedDate,
      status: w.status,
      title: w.title,
      phase: w.phase,
      weekNumber: w.weekNumber,
      feeling: w.feeling,
      notes: w.notes,
      programName: w.enrollment ? (getProgram(w.enrollment.programKey)?.name ?? null) : null,
      exercises: w.exercises.map((e) => ({
        name: e.exercise.name,
        section: e.section,
        custom: e.exercise.ownerId !== null,
        equipment: e.exercise.equipment,
        primaryMuscles: parseMuscles(e.exercise.primaryMuscles).map((m) => MUSCLE_LABELS[m]),
        notes: e.notes,
        sets: e.sets,
      })),
    })),
  };
}
