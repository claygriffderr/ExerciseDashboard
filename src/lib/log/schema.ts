import { z } from "zod";
import type { Muscle } from "../training/muscles";

export const FEELINGS = ["GREAT", "GOOD", "OKAY", "COULD_BE_BETTER", "OFF_GAME"] as const;
export type Feeling = (typeof FEELINGS)[number];

export const FEELING_LABELS: Record<Feeling, { label: string; emoji: string }> = {
  GREAT: { label: "Felt great!", emoji: "💪" },
  GOOD: { label: "Good", emoji: "🙂" },
  OKAY: { label: "Okay", emoji: "😐" },
  COULD_BE_BETTER: { label: "Could have been better", emoji: "😕" },
  OFF_GAME: { label: "Totally off my game", emoji: "😩" },
};

export const NOTES_MAX = 5000;
export const MAX_SETS = 20;
export const MAX_EXERCISES = 30;

const id = z.string().min(1).max(64);
const weight = z.number().min(0).max(1500).nullable();
const reps = z.number().int().min(0).max(100).nullable();

const setLogSchema = z.object({
  /** Existing set; leave out for a set the person added. */
  id: id.optional(),
  weight,
  reps,
  done: z.boolean(),
});
export type SetLog = z.infer<typeof setLogSchema>;

const exerciseLogSchema = z.object({
  /** Existing exercise in this workout. */
  id: id.optional(),
  /** Exercise from the library (for one the person added). */
  exerciseId: id.optional(),
  sets: z.array(setLogSchema).max(MAX_SETS, { error: `Use ${MAX_SETS} sets or fewer per exercise.` }),
});
export type ExerciseLog = z.infer<typeof exerciseLogSchema>;

export const workoutLogSchema = z.object({
  exercises: z.array(exerciseLogSchema).max(MAX_EXERCISES, { error: `Use ${MAX_EXERCISES} exercises or fewer.` }),
  feeling: z.enum(FEELINGS).nullable(),
  notes: z.string().max(NOTES_MAX, { error: `Notes can be up to ${NOTES_MAX} characters.` }),
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;

export const PATTERNS = ["push", "pull", "legs", "core"] as const;
export const CUSTOM_EQUIPMENT = ["barbell", "dumbbell", "kettlebell", "machine", "cable", "bodyweight", "other"] as const;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, { error: "Give it a name." }).max(60, { error: "Keep the name under 60 characters." }),
  pattern: z.enum(PATTERNS, { error: "Choose a type." }),
  equipment: z.enum(CUSTOM_EQUIPMENT, { error: "Choose the equipment." }),
  primaryMuscles: z.array(z.string()).max(6),
  description: z.string().trim().max(1000, { error: "Keep the description under 1000 characters." }),
});
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

/** What a set row shows as its plan. */
export type SetTarget = { reps: number | null; repsMax: number | null; weight: number | null; amrap: boolean; percent: number | null };

/**
 * Fill in a set the person ticked as done without typing numbers: they did
 * what was planned. AMRAP reps stay empty, since only they know the count.
 */
export function resolveSet(set: SetLog, target: SetTarget | null): SetLog {
  if (!set.done || !target) return set;
  return {
    ...set,
    weight: set.weight ?? target.weight,
    reps: set.reps ?? (target.amrap ? null : target.reps),
  };
}

export type LibraryExercise = {
  id: string;
  name: string;
  pattern: string;
  equipment: string | null;
  primary: Muscle[];
  custom: boolean;
};

/** The workout page's text inputs as a log to save. Blank or invalid numbers become null. */
export function toLog(
  exercises: { id?: string; exerciseId: string; sets: { id?: string; weight: string; reps: string; done: boolean }[] }[],
  feeling: Feeling | null,
  notes: string,
): WorkoutLog {
  const num = (v: string, int: boolean) => {
    const n = int ? Number.parseInt(v, 10) : Number.parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    exercises: exercises.map((e) => ({
      ...(e.id ? { id: e.id } : { exerciseId: e.exerciseId }),
      sets: e.sets.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        weight: num(s.weight, false),
        reps: num(s.reps, true),
        done: s.done,
      })),
    })),
    feeling,
    notes,
  };
}
