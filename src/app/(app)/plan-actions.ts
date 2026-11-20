"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { todayIn } from "@/lib/dates";
import { validatePlan } from "@/lib/plan/settings";
import { createPlan, getActivePlan, updatePlan } from "@/lib/plan/store";
import * as workouts from "@/lib/plan/workouts";
import type { ActionResult } from "@/lib/plan/workouts";
import { prisma } from "@/lib/db";
import { customExerciseSchema, workoutLogSchema, type LibraryExercise } from "@/lib/log/schema";
import { createCustomExercise, saveWorkoutLog } from "@/lib/log/store";

export type PlanResult = { ok: false; errors: Record<string, string> };

const idSchema = z.string().min(1).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const testSetSchema = z.object({
  weight: z.number().positive().max(1500),
  reps: z.number().int().min(1).max(15),
});
const testSetsSchema = z.partialRecord(z.enum(["squat", "bench", "deadlift", "press"]), testSetSchema);

function done(result: ActionResult): ActionResult {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const invalid: ActionResult = { ok: false, error: "Something in that request wasn't valid. Reload the page and try again." };

/** Finish onboarding: save the plan, build the first workouts and open the calendar. */
export async function completeOnboarding(raw: unknown): Promise<PlanResult> {
  const user = await requireUser();
  const result = validatePlan(raw);
  if (!result.ok) return result;
  const { input } = result.plan;
  if (input.startDate < todayIn(input.timezone)) return { ok: false, errors: { startDate: "Pick today or a later start date." } };
  await createPlan(user.id, result.plan);
  revalidatePath("/", "layout");
  redirect("/calendar");
}

/** Save changes from Settings. A different program starts a new plan. */
export async function savePlanSettings(raw: unknown): Promise<PlanResult | { ok: true }> {
  const user = await requireUser();
  const result = validatePlan(raw);
  if (!result.ok) return result;
  const current = await getActivePlan(user.id);
  const { input, program } = result.plan;
  if (current?.program.key !== program.key && input.startDate < todayIn(input.timezone)) {
    return { ok: false, errors: { startDate: "Pick today or a later start date for the new program." } };
  }
  await updatePlan(user.id, result.plan);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveWorkoutAction(workoutId: string, date: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success || !dateSchema.safeParse(date).success) return invalid;
  return done(await workouts.moveWorkout(user.id, workoutId, date));
}

export async function restoreUsualDaysAction(): Promise<ActionResult> {
  const user = await requireUser();
  return done(await workouts.restoreUsualDays(user.id));
}

export async function completeWorkoutAction(workoutId: string, input: { date: string; log?: unknown }): Promise<ActionResult> {
  const user = await requireUser();
  const date = dateSchema.safeParse(input?.date);
  const log = workoutLogSchema.optional().safeParse(input?.log);
  if (!idSchema.safeParse(workoutId).success || !date.success) return invalid;
  if (!log.success) return { ok: false, error: log.error.issues[0]?.message ?? "Something in the log wasn't valid." };
  return done(await workouts.completeWorkout(user.id, workoutId, { date: date.data, log: log.data }));
}

export async function saveWorkoutLogAction(workoutId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const log = workoutLogSchema.safeParse(input);
  if (!idSchema.safeParse(workoutId).success) return invalid;
  if (!log.success) return { ok: false, error: log.error.issues[0]?.message ?? "Something in the log wasn't valid." };
  return done(await saveWorkoutLog(user.id, workoutId, log.data));
}

export async function createCustomExerciseAction(
  input: unknown,
): Promise<{ ok: true; exercise: LibraryExercise } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the exercise details." };
  const count = await prisma.exercise.count({ where: { ownerId: user.id } });
  if (count >= 200) return { ok: false, error: "You've reached the limit of 200 custom exercises." };
  const exercise = await createCustomExercise(user.id, parsed.data);
  revalidatePath("/exercises");
  return { ok: true, exercise };
}

export async function skipWorkoutAction(workoutId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return invalid;
  return done(await workouts.skipWorkout(user.id, workoutId));
}

export async function undoWorkoutAction(workoutId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return invalid;
  return done(await workouts.undoWorkout(user.id, workoutId));
}

export async function submitTestResultsAction(sets: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = testSetsSchema.safeParse(sets);
  if (!parsed.success) return { ok: false, error: "Enter a weight and between 1 and 15 reps for each lift." };
  return done(await workouts.submitTestResults(user.id, parsed.data));
}

export async function startNextCycleAction(): Promise<ActionResult> {
  const user = await requireUser();
  return done(await workouts.startNextCycle(user.id));
}

export async function handleGapAction(action: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.enum(["continue", "repeat-week", "lower-training-max"]).safeParse(action);
  if (!parsed.success) return invalid;
  return done(await workouts.handleGap(user.id, parsed.data));
}
