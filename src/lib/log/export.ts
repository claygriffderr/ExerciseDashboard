import { FEELING_LABELS, type Feeling } from "./schema";

/** Rows as they come from the database, trimmed to what the export needs. */
export type ExportWorkoutRow = {
  performedDate: string | null;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  title: string;
  phase: string | null;
  weekNumber: number | null;
  feeling: Feeling | null;
  notes: string | null;
  programName: string | null;
  exercises: {
    name: string;
    section: "WARMUP" | "MAIN" | "SUPPLEMENTAL" | "ACCESSORY";
    custom: boolean;
    equipment: string | null;
    primaryMuscles: string[];
    notes: string | null;
    sets: {
      setNumber: number;
      targetReps: number | null;
      targetRepsMax: number | null;
      targetWeight: number | null;
      targetPercent: number | null;
      targetRir: number | null;
      isAmrap: boolean;
      actualReps: number | null;
      actualWeight: number | null;
      completed: boolean;
    }[];
  }[];
};

export type ExportInput = {
  exportedAt: Date;
  from: string | null;
  to: string | null;
  plan: {
    program: string;
    startDate: string;
    trainingDays: string[];
    choices: Record<string, string>;
    lifts: Record<string, string>;
    trainingMaxes: { lift: string; exercise: string; trainingMax: number }[];
  } | null;
  trainingMaxHistory: { date: string; exercise: string; trainingMax: number; source: string }[];
  workouts: ExportWorkoutRow[];
};

const SECTION_NAMES = { WARMUP: "warm-up", MAIN: "main", SUPPLEMENTAL: "volume", ACCESSORY: "assistance" } as const;

const ABOUT = [
  "Strength training history exported from Exercise Dashboard. Weights are in pounds (lb).",
  "The program is Jim Wendler's 5/3/1. 'trainingMax' is the number each lift's weights are calculated from (85 to 90% of an estimated one-rep max).",
  "Each workout lists its exercises in order. Every set has 'planned' (the program's target, if any) and 'done' (what the person logged).",
  "'asManyAsPossible' sets are done for as many good reps as possible; more reps than planned there is a sign of progress.",
  "Dumbbell weights are per hand. 'feeling' is the person's own rating of the session; 'notes' are their free-text notes.",
  "Skipped workouts are included so gaps and patterns are visible.",
].join(" ");

/** Turn database rows into a self-explaining JSON document for review by a person or an AI. */
export function buildExport(input: ExportInput) {
  const workouts = input.workouts
    .filter((w) => w.status !== "PLANNED" && w.performedDate)
    .sort((a, b) => a.performedDate!.localeCompare(b.performedDate!))
    .map((w) => {
      const exercises = w.exercises.map((e) => ({
        name: e.name,
        section: SECTION_NAMES[e.section],
        ...(e.custom ? { custom: true } : {}),
        ...(e.equipment ? { equipment: e.equipment } : {}),
        ...(e.primaryMuscles.length ? { muscles: e.primaryMuscles } : {}),
        ...(e.notes ? { note: e.notes } : {}),
        sets: e.sets
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => {
            const planned =
              s.targetReps === null && s.targetWeight === null
                ? null
                : {
                    reps: s.targetRepsMax ? `${s.targetReps}-${s.targetRepsMax}` : s.targetReps,
                    weight: s.targetWeight,
                    ...(s.targetPercent ? { percentOfTrainingMax: Math.round(s.targetPercent * 100) } : {}),
                    ...(s.isAmrap ? { asManyAsPossible: true } : {}),
                    ...(s.targetRir !== null ? { repsInReserve: s.targetRir } : {}),
                  };
            const done = s.actualReps !== null || s.actualWeight !== null ? { weight: s.actualWeight, reps: s.actualReps } : null;
            return { set: s.setNumber, planned, done, completed: s.completed };
          }),
      }));
      const logged = exercises.some((e) => e.sets.some((s) => s.done || s.completed));
      return {
        date: w.performedDate!,
        status: w.status === "COMPLETED" ? "completed" : "skipped",
        title: w.title,
        ...(w.programName ? { program: w.programName } : {}),
        ...(w.phase ? { phase: w.phase } : {}),
        ...(w.weekNumber ? { week: w.weekNumber } : {}),
        feeling: w.feeling ? FEELING_LABELS[w.feeling].label : null,
        notes: w.notes,
        ...(w.status === "COMPLETED" && !logged ? { setsLogged: false } : {}),
        exercises: w.status === "SKIPPED" && !logged ? [] : exercises,
      };
    });

  const completed = workouts.filter((w) => w.status === "completed").length;
  return {
    format: "exercise-dashboard-history",
    version: 1,
    exportedAt: input.exportedAt.toISOString(),
    units: "lb",
    about: ABOUT,
    range: { from: input.from ?? workouts[0]?.date ?? null, to: input.to ?? workouts.at(-1)?.date ?? null },
    summary: {
      workoutsCompleted: completed,
      workoutsSkipped: workouts.length - completed,
      withNotes: workouts.filter((w) => w.notes).length,
    },
    plan: input.plan,
    trainingMaxHistory: input.trainingMaxHistory,
    workouts,
  };
}

/** A starting prompt for asking an AI to review the export. */
export const AI_PROMPT =
  "Attached is my strength training history (JSON, weights in lb) from a 5/3/1 program. Please look for patterns: which lifts are progressing or stalling, how my ratings and notes relate to performance, how consistent I've been, and whether my weights look right for my training maxes. Then suggest two or three specific, safe changes for my next cycle, and tell me anything in my notes that sounds like a reason to slow down or see a professional.";
