import { LIFT_SLOTS, type LiftSlot } from "../training/five-three-one";
import { PROGRAMS } from "../training/programs";
import type { ProgramDefinition, ProgramSettings, TrainingMaxes } from "../training/programs/types";
import { DEFAULT_WEEKDAYS } from "../training/schedule";
import type { ExperienceLevel, MaxMethod } from "./settings";

/**
 * The setup wizard's working state. Numbers people type stay strings until
 * the answers are checked, so half-typed values don't jump around.
 */
export type LiftDraft = { method: MaxMethod; weight: string; reps: string };

export type Draft = {
  experienceLevel: ExperienceLevel | null;
  programKey: string;
  daysPerWeek: number;
  trainingWeekdays: number[];
  /** Null means "today". */
  startDate: string | null;
  variants: Record<LiftSlot, string>;
  options: Record<string, string | number | boolean>;
  barWeight: number;
  plates: number[];
  mode: "test" | "enter";
  lifts: Record<LiftSlot, LiftDraft>;
};

export type OptionValue = string | number | boolean;

export function emptyLifts(): Record<LiftSlot, LiftDraft> {
  const out = {} as Record<LiftSlot, LiftDraft>;
  for (const { slot } of LIFT_SLOTS) out[slot] = { method: "recentSet", weight: "", reps: "5" };
  return out;
}

export function hasIntro(program: ProgramDefinition): boolean {
  return program.phases.some((p) => p.key !== "main");
}

export function optionValues(program: ProgramDefinition, settings: ProgramSettings): Record<string, OptionValue> {
  return Object.fromEntries(program.options.map((o) => [o.key, settings[o.key] as OptionValue]));
}

/** Everything that resets when someone picks a different program. */
export function programDefaults(program: ProgramDefinition) {
  const s = program.defaultSettings;
  return {
    programKey: program.key,
    daysPerWeek: s.daysPerWeek,
    trainingWeekdays: DEFAULT_WEEKDAYS[s.daysPerWeek] ?? [],
    variants: { ...s.variants },
    options: optionValues(program, s),
    mode: hasIntro(program) ? ("test" as const) : ("enter" as const),
  };
}

export function newDraft(gear: { barWeight: number; plates: number[] }): Draft {
  return {
    experienceLevel: null,
    ...programDefaults(PROGRAMS[0]),
    startDate: null,
    barWeight: gear.barWeight,
    plates: gear.plates,
    lifts: emptyLifts(),
  };
}

/** The wizard prefilled from a saved plan, for Settings. */
export function draftFromPlan(plan: {
  experienceLevel: ExperienceLevel;
  program: ProgramDefinition;
  settings: ProgramSettings;
  trainingWeekdays: number[];
  startDate: string;
  gear: { barWeight: number; plates: number[] };
  trainingMaxes: TrainingMaxes;
}): Draft {
  const lifts = emptyLifts();
  const known = LIFT_SLOTS.every(({ slot }) => plan.trainingMaxes[slot] !== undefined);
  for (const { slot } of LIFT_SLOTS) {
    const tm = plan.trainingMaxes[slot];
    if (tm !== undefined) lifts[slot] = { method: "trainingMax", weight: String(tm), reps: "5" };
  }
  return {
    experienceLevel: plan.experienceLevel,
    programKey: plan.program.key,
    daysPerWeek: plan.settings.daysPerWeek,
    trainingWeekdays: plan.trainingWeekdays,
    startDate: plan.startDate,
    variants: { ...plan.settings.variants },
    options: optionValues(plan.program, plan.settings),
    barWeight: plan.gear.barWeight,
    plates: plan.gear.plates,
    mode: known ? "enter" : "test",
    lifts,
  };
}

/** The draft in the shape the server checks. */
export function draftToInput(d: Draft, timezone: string, today: string) {
  const lifts: Record<string, { method: MaxMethod; weight: number; reps?: number }> = {};
  if (d.mode === "enter") {
    for (const { slot } of LIFT_SLOTS) {
      const l = d.lifts[slot];
      const weight = Number.parseFloat(l.weight);
      if (!(weight > 0)) continue;
      const reps = Number.parseInt(l.reps, 10);
      lifts[slot] = { method: l.method, weight, ...(l.method === "recentSet" && reps > 0 ? { reps } : {}) };
    }
  }
  return {
    experienceLevel: d.experienceLevel,
    programKey: d.programKey,
    daysPerWeek: d.daysPerWeek,
    trainingWeekdays: d.trainingWeekdays,
    startDate: d.startDate ?? today,
    variants: d.variants,
    options: d.options,
    equipment: { barWeight: d.barWeight, plates: d.plates },
    startingWeights: { mode: d.mode, lifts },
    timezone,
  };
}

/** Which wizard step each kind of error belongs to. */
export const ERROR_STEP: Record<string, string> = {
  experienceLevel: "experience",
  programKey: "program",
  daysPerWeek: "schedule",
  trainingWeekdays: "schedule",
  startDate: "schedule",
  variants: "lifts",
  options: "options",
  equipment: "equipment",
  startingWeights: "weights",
  timezone: "review",
  form: "review",
};

/** How a weekly frequency plays out in each program. */
export function daysExplanation(program: ProgramDefinition, days: number): string {
  if (program.key === "beginner-onramp") {
    return days === 2
      ? "Two full-body sessions a week, alternating between two workouts. Lots of rest in between; each program week takes a little longer."
      : "Three full-body sessions a week, as the program was designed. Each main lift gets practiced twice a week.";
  }
  if (days === 4) return "One program week every calendar week, as Wendler designed it. A full cycle takes about a month.";
  if (days === 3) return "Each program week (four sessions) takes about a week and a half. More rest between sessions.";
  return "Each program week takes two calendar weeks. Slower progress, but easy to fit around a busy life.";
}
