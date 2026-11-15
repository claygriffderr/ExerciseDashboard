import { z } from "zod";
import { isDateStr, isValidTimeZone } from "../dates";
import { EXERCISE_BY_SLUG } from "../training/exercises";
import { estimateOneRepMax, LIFT_SLOTS, trainingMaxFromOneRepMax, type LiftSlot } from "../training/five-three-one";
import { ALL_PLATE_SIZES } from "../training/plates";
import { getProgram } from "../training/programs";
import type { ProgramDefinition, ProgramSettings, TrainingMaxes } from "../training/programs/types";

export const EXPERIENCE_LEVELS = ["NEW_TO_LIFTING", "SOME_EXPERIENCE", "EXPERIENCED"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_INFO: Record<ExperienceLevel, { label: string; explanation: string; program: string }> = {
  NEW_TO_LIFTING: {
    label: "New to lifting",
    explanation: "You've done little or no strength training, or it's been years. You'd like to learn the basics safely.",
    program: "beginner-onramp",
  },
  SOME_EXPERIENCE: {
    label: "Some experience",
    explanation: "You've lifted on and off and know some of the exercises, but haven't followed a structured program for long.",
    program: "beginner-onramp",
  },
  EXPERIENCED: {
    label: "Experienced",
    explanation: "You've trained consistently for months or years and are comfortable with the squat, bench, deadlift and overhead press.",
    program: "standard",
  },
};

export const MAX_METHODS = ["recentSet", "oneRepMax", "trainingMax"] as const;
export type MaxMethod = (typeof MAX_METHODS)[number];

export const MAX_METHOD_INFO: Record<MaxMethod, { label: string; explanation: string }> = {
  recentSet: {
    label: "A recent set",
    explanation: "The weight and reps of a hard set from the last few weeks. The safest way to estimate, since you never need to max out.",
  },
  oneRepMax: { label: "My one-rep max", explanation: "The most you've lifted once with good form, recently." },
  trainingMax: { label: "My training max", explanation: "If you already run 5/3/1 and know your training max." },
};

const liftEntrySchema = z.object({
  method: z.enum(MAX_METHODS, { error: "Choose how you'll enter this lift." }),
  weight: z.number({ error: "Enter a weight." }).positive({ error: "Enter a weight above 0." }).max(1500, { error: "That weight looks too high." }),
  reps: z.number().int().min(1, { error: "Enter at least 1 rep." }).max(15, { error: "Use a set of 15 reps or fewer." }).optional(),
});
export type LiftEntry = z.infer<typeof liftEntrySchema>;

export const onboardingSchema = z.object({
  experienceLevel: z.enum(EXPERIENCE_LEVELS, { error: "Choose your experience level." }),
  programKey: z.string({ error: "Choose a program." }),
  daysPerWeek: z.number({ error: "Choose how many days a week to train." }).int(),
  trainingWeekdays: z.array(z.number().int().min(0).max(6), { error: "Pick your training days." }),
  startDate: z.string({ error: "Choose a start date." }).refine(isDateStr, "Choose a start date."),
  variants: z.record(z.string(), z.string()),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  equipment: z.object({
    barWeight: z.number().min(0).max(100),
    plates: z.array(z.number()).min(1, { error: "Choose at least one plate size." }),
  }),
  startingWeights: z.object({
    mode: z.enum(["test", "enter"], { error: "Choose how to set your starting weights." }),
    lifts: z.partialRecord(z.enum(["squat", "bench", "deadlift", "press"]), liftEntrySchema).default({}),
  }),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone."),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type ValidatedPlan = {
  input: OnboardingInput;
  program: ProgramDefinition;
  settings: ProgramSettings;
  /** Training maxes from the entered numbers; empty when the test week will find them. */
  trainingMaxes: TrainingMaxes;
  /** True when the program's learn/test phases should run first. */
  runIntro: boolean;
};

/** Training max from what the person entered. */
export function trainingMaxFromEntry(entry: LiftEntry, tmPercent: number): number {
  const raw =
    entry.method === "trainingMax"
      ? entry.weight
      : trainingMaxFromOneRepMax(entry.method === "oneRepMax" ? entry.weight : estimateOneRepMax(entry.weight, entry.reps ?? 1), tmPercent);
  return Math.round(raw * 2) / 2;
}

/** Program settings from defaults plus the person's choices (only allowed values). */
export function resolveSettings(program: ProgramDefinition, input: Pick<OnboardingInput, "daysPerWeek" | "variants" | "options">): ProgramSettings {
  const settings: ProgramSettings = structuredClone(program.defaultSettings);
  settings.daysPerWeek = input.daysPerWeek;
  for (const { slot } of LIFT_SLOTS) {
    const slug = input.variants[slot];
    if (slug) settings.variants[slot] = slug;
  }
  for (const option of program.options) {
    const value = input.options[option.key];
    if (value !== undefined && option.choices.some((c) => c.value === value)) {
      (settings as Record<string, unknown>)[option.key] = value;
    }
  }
  return settings;
}

/** Check onboarding answers against the program's rules. Returns errors keyed by step. */
export function validatePlan(raw: unknown): { ok: true; plan: ValidatedPlan } | { ok: false; errors: Record<string, string> } {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }
  const input = parsed.data;
  const errors: Record<string, string> = {};
  const program = getProgram(input.programKey);
  if (!program) return { ok: false, errors: { programKey: "Choose a program." } };

  if (!program.daysPerWeekOptions.includes(input.daysPerWeek)) errors.daysPerWeek = "Choose how many days a week to train.";
  const days = new Set(input.trainingWeekdays);
  if (days.size !== input.trainingWeekdays.length || days.size !== input.daysPerWeek) {
    errors.trainingWeekdays = `Pick exactly ${input.daysPerWeek} training days.`;
  }
  for (const { slot, label } of LIFT_SLOTS) {
    const ex = EXERCISE_BY_SLUG.get(input.variants[slot] ?? "");
    if (!ex || ex.slot !== slot) errors.variants ??= `Choose an exercise for the ${label.toLowerCase()}.`;
  }
  const plates = input.equipment.plates;
  if (plates.some((p) => !ALL_PLATE_SIZES.includes(p))) errors.equipment = "Unknown plate size.";

  const settings = resolveSettings(program, input);
  const hasIntro = program.phases.some((p) => p.key !== "main");
  const runIntro = hasIntro && input.startingWeights.mode === "test";
  if (input.startingWeights.mode === "test" && !hasIntro) {
    errors.startingWeights = "Enter your starting weights for this program.";
  }
  const trainingMaxes: TrainingMaxes = {};
  if (input.startingWeights.mode === "enter") {
    for (const { slot, label } of LIFT_SLOTS) {
      const entry = input.startingWeights.lifts[slot as LiftSlot];
      if (!entry) {
        errors.startingWeights ??= `Enter a starting weight for the ${label.toLowerCase()}.`;
        continue;
      }
      if (entry.method === "recentSet" && !entry.reps) {
        errors.startingWeights ??= `Enter how many reps you did on the ${label.toLowerCase()}.`;
        continue;
      }
      trainingMaxes[slot] = trainingMaxFromEntry(entry, settings.trainingMaxPercent);
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, plan: { input, program, settings, trainingMaxes, runIntro } };
}

/** Read stored settings JSON, falling back to the program defaults for anything missing. */
export function parseStoredSettings(program: ProgramDefinition, json: string): ProgramSettings {
  let stored: Partial<ProgramSettings> = {};
  try {
    const v: unknown = JSON.parse(json);
    if (v && typeof v === "object") stored = v as Partial<ProgramSettings>;
  } catch {
    // fall through to defaults
  }
  const defaults = program.defaultSettings;
  return {
    ...defaults,
    ...stored,
    variants: { ...defaults.variants, ...(stored.variants ?? {}) },
    increments: { ...defaults.increments, ...(stored.increments ?? {}) },
  };
}
