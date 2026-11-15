import type { Gear } from "../equipment";
import type { LiftSlot, ProgressionIncrements, WaveStyle } from "../five-three-one";

export type Section = "WARMUP" | "MAIN" | "SUPPLEMENTAL" | "ACCESSORY";

export type PlannedSet = {
  reps: number;
  /** Upper end when the target is a range, e.g. 8 to 10. */
  repsMax?: number;
  /** Fraction of the training max, when the set is percentage-based. */
  percent?: number;
  /** Loadable weight in lb, or null when the person picks the weight. */
  weight: number | null;
  /** Last set: as many good reps as possible. */
  amrap?: boolean;
  /** Stop with this many reps left in the tank. */
  repsInReserve?: number;
};

export type PlannedExercise = {
  exerciseSlug: string;
  section: Section;
  slot?: LiftSlot;
  sets: PlannedSet[];
  note?: string;
};

export type PlannedWorkout = {
  /** Stable id within a cycle, e.g. "main-c1-w2-d3". */
  key: string;
  title: string;
  phase: string;
  /** Week within the phase or cycle, from 1. */
  week: number;
  /** Session within the week, from 1. */
  day: number;
  guidance?: string;
  exercises: PlannedExercise[];
};

export type TrainingMaxes = Partial<Record<LiftSlot, number>>;

export type ProgramSettings = {
  daysPerWeek: number;
  /** Exercise slug used for each main-lift slot. */
  variants: Record<LiftSlot, string>;
  /** Training max as a fraction of the one-rep max. */
  trainingMaxPercent: number;
  waveStyle: WaveStyle;
  /** Extra volume after the main sets: 5×10 (BBB), 5×5 (First Set Last) or none. */
  supplemental: "bbb" | "fsl" | "none";
  /** Boring But Big weight as a fraction of the training max. */
  supplementalPercent: number;
  includeDeload: boolean;
  increments: ProgressionIncrements;
  /** Beginner on-ramp: weeks spent learning the lifts before testing. */
  learnWeeks: number;
};

export type ChoiceOption<T extends string | number | boolean> = {
  value: T;
  label: string;
  explanation: string;
  recommended?: boolean;
};

/** A setting a person chooses during onboarding, with plain-language help. */
export type ProgramOption = {
  key: keyof ProgramSettings;
  label: string;
  explanation: string;
  choices: ChoiceOption<string | number | boolean>[];
  /** Only ask when this returns true for the current settings. */
  showWhen?: (settings: ProgramSettings) => boolean;
};

export type Phase = {
  key: string;
  name: string;
  description: string;
};

export type BuildContext = {
  settings: ProgramSettings;
  trainingMaxes: TrainingMaxes;
  gear: Gear;
  /** Which cycle of the main phase, from 1. */
  cycle: number;
};

export type ProgramDefinition = {
  key: string;
  name: string;
  tagline: string;
  /** Who it suits. */
  audience: string;
  summary: string;
  benefits: string[];
  whatItInvolves: string[];
  thingsToKnow: string[];
  sources: { label: string; url?: string }[];
  daysPerWeekOptions: number[];
  defaultSettings: ProgramSettings;
  options: ProgramOption[];
  phases: Phase[];
  /** Sessions before the main cycles (learning, testing). No training maxes needed. */
  buildIntro(ctx: Omit<BuildContext, "trainingMaxes" | "cycle">): PlannedWorkout[];
  /** One cycle of the main phase. */
  buildCycle(ctx: BuildContext): PlannedWorkout[];
};
