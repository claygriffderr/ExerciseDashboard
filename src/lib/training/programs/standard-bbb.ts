import { AMRAP_GOALS, STANDARD_INCREMENTS, WAVE, type LiftSlot } from "../five-three-one";
import { mainLiftBlocks, selfLoadedSets, volumeSets } from "./builders";
import type { PlannedWorkout, ProgramDefinition } from "./types";

/** Wendler's original Boring But Big day order and assistance. */
const DAYS: { slot: LiftSlot; title: string; accessory: { slug: string; sets: number; reps: number } }[] = [
  { slot: "press", title: "Press day", accessory: { slug: "chin-up", sets: 5, reps: 10 } },
  { slot: "deadlift", title: "Deadlift day", accessory: { slug: "hanging-leg-raise", sets: 5, reps: 15 } },
  { slot: "bench", title: "Bench day", accessory: { slug: "dumbbell-row", sets: 5, reps: 10 } },
  { slot: "squat", title: "Squat day", accessory: { slug: "leg-curl", sets: 5, reps: 10 } },
];

export const standardBbb: ProgramDefinition = {
  key: "standard-bbb",
  name: "5/3/1 Boring But Big",
  tagline: "The classic: one main lift a day, then lots of lighter volume.",
  audience:
    "Lifters who already know the squat, bench press, deadlift and overhead press and can lift with good form. Typically people with at least a few months of steady training.",
  summary:
    "Each session centers on one of the four main lifts. You do three heavy sets that follow a four-week wave, then five sets of ten with a lighter weight to build muscle, then one assistance exercise. Your training max goes up a little after every cycle.",
  benefits: [
    "Slow, steady progress you can keep up for years: about 5 lb a month on upper-body lifts and 10 lb on lower-body lifts.",
    "Starting from a training max below your true max means most sets feel manageable, so you practice good reps instead of grinding.",
    "The 5×10 supplemental sets add a lot of volume, which is one of the strongest drivers of muscle growth.",
    "The last set of each week shows how you're progressing without needing a max-out day.",
  ],
  whatItInvolves: [
    "Four sessions per program week: press, deadlift, bench, squat. Train 2, 3 or 4 days a week; the next session waits for your next training day.",
    "Warm-up: 40%, 50% and 60% of your training max.",
    "Main sets follow the wave: 5s week (65/75/85%), 3s week (70/80/90%), 5/3/1 week (75/85/95%), then a light deload week.",
    "The last main set is 'as many reps as possible' with good form, leaving a rep or two in reserve.",
    "Boring But Big: 5 sets of 10 at 50 to 60% of the training max of the same lift.",
    "One assistance exercise, as in Wendler's original template: chin-ups, hanging leg raises, dumbbell rows or leg curls.",
    "Sessions take about 45 to 75 minutes.",
  ],
  thingsToKnow: [
    "Last-set targets: about " + AMRAP_GOALS[1] + " reps in the 5s week, " + AMRAP_GOALS[2] + " in the 3s week and " + AMRAP_GOALS[3] + " in the 5/3/1 week.",
    "If you can't get the minimum reps on a last set, lower that lift's training max by 10% and build back up.",
    "5×10 is demanding. Start at 50% and only move to 60% once it feels comfortable.",
  ],
  sources: [
    { label: "Jim Wendler, 5/3/1: The Simplest and Most Effective Training System for Raw Strength (2nd ed., 2011)" },
    { label: "Jim Wendler, Boring But Big template, in Beyond 5/3/1 (2013)" },
    { label: "Strength Insider: 5/3/1 program guide", url: "https://strengthinsider.com/workout-programs/531-program/" },
  ],
  daysPerWeekOptions: [2, 3, 4],
  defaultSettings: {
    daysPerWeek: 4,
    variants: { squat: "back-squat", bench: "bench-press", deadlift: "deadlift", press: "overhead-press" },
    trainingMaxPercent: 0.9,
    waveStyle: "classic",
    supplementalPercent: 0.5,
    includeDeload: true,
    increments: STANDARD_INCREMENTS,
    learnWeeks: 0,
  },
  options: [
    {
      key: "supplementalPercent",
      label: "Boring But Big weight",
      explanation: "How heavy the 5 sets of 10 are, as a share of your training max.",
      choices: [
        { value: 0.5, label: "50%", explanation: "Wendler's starting point. Still hard by the last set.", recommended: true },
        { value: 0.6, label: "60%", explanation: "For when 50% has started to feel easy." },
      ],
    },
    {
      key: "includeDeload",
      label: "Deload week",
      explanation: "A light fourth week that lets your body recover before the next cycle.",
      choices: [
        { value: true, label: "Include it", explanation: "Recommended. Recovery is when you actually get stronger.", recommended: true },
        { value: false, label: "Skip it", explanation: "Three-week cycles. Only if you recover well and deload on your own when needed." },
      ],
    },
    {
      key: "trainingMaxPercent",
      label: "Training max",
      explanation: "All weights are based on a training max, a bit below your true one-rep max.",
      choices: [
        { value: 0.9, label: "90% of max", explanation: "The standard 5/3/1 setting.", recommended: true },
        { value: 0.85, label: "85% of max", explanation: "Lighter, more reps on last sets. Good after a break." },
      ],
    },
  ],
  phases: [{ key: "main", name: "5/3/1 cycles", description: "Repeat four-week cycles, raising the training max each time." }],

  buildIntro() {
    return [];
  },

  buildCycle({ settings, trainingMaxes, gear, cycle }) {
    const weeks: (1 | 2 | 3 | 4)[] = settings.includeDeload ? [1, 2, 3, 4] : [1, 2, 3];
    const out: PlannedWorkout[] = [];
    for (const week of weeks) {
      DAYS.forEach((day, i) => {
        const slug = settings.variants[day.slot];
        const exercises = mainLiftBlocks({ slot: day.slot, exerciseSlug: slug, week, style: settings.waveStyle, tms: trainingMaxes, gear });
        if (week !== 4) {
          exercises.push(
            volumeSets({
              slot: day.slot,
              exerciseSlug: slug,
              percent: settings.supplementalPercent,
              sets: 5,
              reps: 10,
              tms: trainingMaxes,
              gear,
              note: "Boring But Big",
            }),
          );
          exercises.push(selfLoadedSets(day.accessory.slug, "ACCESSORY", day.accessory.sets, day.accessory.reps));
        }
        out.push({
          key: `main-c${cycle}-w${week}-d${i + 1}`,
          title: day.title,
          phase: "main",
          week,
          day: i + 1,
          guidance:
            week === 4
              ? "Deload: keep it light and quick. Skip the 5×10 today."
              : `${WAVE[week].name}. Last main set: as many good reps as you can, aiming for about ${AMRAP_GOALS[week as 1 | 2 | 3]}.`,
          exercises,
        });
      });
    }
    return out;
  },
};
