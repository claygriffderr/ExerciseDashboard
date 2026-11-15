import { FIRST_SET_PERCENT, GENTLE_INCREMENTS, type LiftSlot } from "../five-three-one";
import { mainLiftBlocks, selfLoadedSets, volumeSets } from "./builders";
import type { PlannedExercise, PlannedWorkout, ProgramDefinition, ProgramSettings } from "./types";

/**
 * Full-body sessions, two main lifts each (from Wendler's 5/3/1 for
 * Beginners). With two training days a week, alternate A and B.
 */
const MAIN_DAYS: { title: string; lifts: [LiftSlot, LiftSlot]; accessories: [string, number, number][] }[] = [
  { title: "Squat + bench", lifts: ["squat", "bench"], accessories: [["dumbbell-row", 3, 10], ["dead-bug", 3, 8]] },
  { title: "Deadlift + press", lifts: ["deadlift", "press"], accessories: [["lat-pulldown", 3, 10], ["split-squat", 3, 8]] },
  { title: "Bench + squat", lifts: ["bench", "squat"], accessories: [["push-up", 3, 8], ["glute-bridge", 3, 10]] },
];

/** Practice sessions: the person's chosen main lifts plus simple assistance. */
const LEARN_DAYS: { title: string; lifts: [LiftSlot, LiftSlot]; accessories: [string, number, number][] }[] = [
  { title: "Practice A: squat + bench", lifts: ["squat", "bench"], accessories: [["dumbbell-row", 2, 10], ["dead-bug", 2, 6]] },
  { title: "Practice B: deadlift + press", lifts: ["deadlift", "press"], accessories: [["lat-pulldown", 2, 10], ["glute-bridge", 2, 10]] },
];

function sessionsPerWeek(settings: ProgramSettings, maxPerWeek: number): number {
  return Math.min(maxPerWeek, Math.max(2, settings.daysPerWeek));
}

function accessories(list: [string, number, number][], sets?: number): PlannedExercise[] {
  return list.map(([slug, s, reps]) => selfLoadedSets(slug, "ACCESSORY", sets ?? s, reps));
}

export const beginnerOnramp: ProgramDefinition = {
  key: "beginner-onramp",
  name: "Beginner on-ramp",
  tagline: "Learn the lifts, find your starting weights, then ease into 5/3/1.",
  audience:
    "Anyone new to strength training or coming back after a long break, at any age. No need to know your max: the program helps you find safe starting weights.",
  summary:
    "You start with a few weeks of light practice sessions to learn each movement and get comfortable with the equipment. Then you do one easy test week to find your starting weights, without ever lifting to your limit. From there you follow 5/3/1 for Beginners, a full-body plan built around three sessions a week. It's adjusted to be gentler, with no all-out sets by default.",
  benefits: [
    "Builds confidence first: technique and comfort come before any heavy weight.",
    "No max testing. Starting weights are estimated from a comfortable set of 5, so you never have to lift to failure.",
    "Full-body sessions train every main lift twice a week, which is ideal for learning and for steady early gains.",
    "Strength training improves bone density, balance, blood sugar control and everyday function at any age.",
    "Works with dumbbells, kettlebells and machine options if a barbell isn't right for you yet.",
  ],
  whatItInvolves: [
    "Phase 1, Learn the lifts (2 weeks by default): two short full-body practice sessions alternate. Use light weights you could lift for at least 3 more reps.",
    "Phase 2, Find your starting weights (2 sessions): build up slowly to a weight you can lift 5 times with about 2 reps left in the tank. The app turns that into a training max.",
    "Phase 3, 5/3/1 for Beginners: three full-body sessions per program week, two main lifts each. Every lift follows the 5/3/1 wave, followed by 5 easier sets of 5 (First Set Last).",
    "Each session ends with a pulling exercise and a leg or core exercise.",
    "Sessions take about 40 to 60 minutes. Train 2 or 3 days a week. A missed day simply moves the next session to your next training day.",
  ],
  thingsToKnow: [
    "'Reps in reserve' means how many more good reps you could have done. Stopping with 2 to 3 in reserve keeps every set safe and productive.",
    "Soreness for a day or two in the first weeks is normal. Sharp or joint pain isn't: stop that exercise and try the easier option.",
    "The training max starts at 85% of your estimated max, lower than the usual 90%, so the first cycles feel easy on purpose.",
    "Weights go up by 5 lb per lift each cycle when you complete all the reps. Small steps on paper, but they add up to a big change over a year.",
    "Check with your doctor before starting if you have a heart condition, high blood pressure, recent surgery or joint problems.",
  ],
  sources: [
    { label: "Jim Wendler, 5/3/1 for Beginners, in 5/3/1 Forever (2017)" },
    {
      label: "Helms et al., Application of the repetitions in reserve-based RPE scale for resistance training (2016)",
      url: "https://pubmed.ncbi.nlm.nih.gov/27531969/",
    },
    {
      label: "Fragala et al., Resistance Training for Older Adults: NSCA Position Statement (2019)",
      url: "https://pubmed.ncbi.nlm.nih.gov/31343601/",
    },
  ],
  daysPerWeekOptions: [2, 3],
  defaultSettings: {
    daysPerWeek: 3,
    variants: {
      squat: "goblet-squat",
      bench: "dumbbell-bench-press",
      deadlift: "kettlebell-deadlift",
      press: "dumbbell-shoulder-press",
    },
    trainingMaxPercent: 0.85,
    waveStyle: "fives-pro",
    supplemental: "fsl",
    supplementalPercent: 0.5,
    includeDeload: false,
    increments: GENTLE_INCREMENTS,
    learnWeeks: 2,
  },
  options: [
    {
      key: "learnWeeks",
      label: "Time to learn the lifts",
      explanation: "How long to practice with light weights before finding your starting weights. There's no rush.",
      choices: [
        { value: 1, label: "1 week", explanation: "If you've lifted before and just need a refresher." },
        { value: 2, label: "2 weeks", explanation: "A good default for most beginners.", recommended: true },
        { value: 4, label: "4 weeks", explanation: "Extra time to build comfort and confidence. Great if everything feels new." },
      ],
    },
    {
      key: "waveStyle",
      label: "How hard the last set is",
      explanation: "In classic 5/3/1 the last set of each lift is 'as many reps as possible'. The gentler option keeps every set at 5 reps.",
      choices: [
        { value: "fives-pro", label: "Steady 5s", explanation: "Every set is 5 reps with reps to spare. Calm and predictable.", recommended: true },
        { value: "classic", label: "Push the last set", explanation: "Do as many good reps as you can on the last set. Faster progress, more effort." },
      ],
    },
    {
      key: "includeDeload",
      label: "Deload week",
      explanation: "An optional light week after every three-week cycle.",
      choices: [
        { value: false, label: "No deload", explanation: "The weights are light enough that most beginners don't need one.", recommended: true },
        { value: true, label: "Include a deload", explanation: "A light fourth week each cycle. Good if you're often tired or sore." },
      ],
    },
  ],
  phases: [
    { key: "learn", name: "Learn the lifts", description: "Light practice sessions to learn each movement and get comfortable with the equipment." },
    { key: "find", name: "Find your starting weights", description: "Build up to a comfortable set of 5 on each lift. No max testing." },
    { key: "main", name: "5/3/1 for Beginners", description: "Full-body 5/3/1 with steady, gentle progress." },
  ],

  buildIntro({ settings }) {
    const out: PlannedWorkout[] = [];
    const perWeek = sessionsPerWeek(settings, 3);
    for (let week = 1; week <= settings.learnWeeks; week++) {
      for (let day = 1; day <= perWeek; day++) {
        // Alternate A/B across the whole phase so both get equal practice.
        const template = LEARN_DAYS[out.length % LEARN_DAYS.length];
        out.push({
          key: `learn-w${week}-d${day}`,
          title: template.title,
          phase: "learn",
          week,
          day,
          guidance:
            "Pick a weight you could lift at least 3 more times. Focus on smooth, controlled reps, and write down the weight you used. If a set feels easy, go up a little next time.",
          exercises: [
            ...template.lifts.map((slot) =>
              selfLoadedSets(settings.variants[slot], "MAIN", 3, 8, { slot, repsInReserve: 3 }),
            ),
            ...accessories(template.accessories),
          ],
        });
      }
    }
    LEARN_DAYS.forEach((template, i) => {
      out.push({
        key: `find-d${i + 1}`,
        title: `Find your weights: ${template.title.replace(/^Practice [AB]: /, "")}`,
        phase: "find",
        week: 1,
        day: i + 1,
        guidance:
          "For each lift, do sets of 5 and go up a little each set. Stop when you reach a weight you can lift 5 times with about 2 reps left in the tank. That last set is your test set, so record its weight. Never go to failure.",
        exercises: template.lifts.map((slot) =>
          selfLoadedSets(settings.variants[slot], "MAIN", 1, 5, {
            slot,
            repsInReserve: 2,
            note: "Test set: 5 reps with about 2 left in the tank. Warm up with a few lighter sets first.",
          }),
        ),
      });
    });
    return out;
  },

  buildCycle({ settings, trainingMaxes, gear, cycle }) {
    const perWeek = sessionsPerWeek(settings, 3);
    const weeks: (1 | 2 | 3 | 4)[] = settings.includeDeload ? [1, 2, 3, 4] : [1, 2, 3];
    // With two days a week, alternate A (squat + bench) and B (deadlift + press).
    const days = perWeek === 2 ? [MAIN_DAYS[0], MAIN_DAYS[1]] : MAIN_DAYS;
    const out: PlannedWorkout[] = [];

    for (const week of weeks) {
      days.forEach((template, i) => {
        const exercises: PlannedExercise[] = [];
        template.lifts.forEach((slot) => {
          const slug = settings.variants[slot];
          exercises.push(
            ...mainLiftBlocks({
              slot,
              exerciseSlug: slug,
              week,
              style: settings.waveStyle,
              tms: trainingMaxes,
              gear,
            }),
          );
          if (week !== 4) {
            exercises.push(
              volumeSets({
                slot,
                exerciseSlug: slug,
                percent: FIRST_SET_PERCENT[week],
                sets: 5,
                reps: 5,
                tms: trainingMaxes,
                gear,
                note: "First Set Last: 5 sets of 5 at your first work-set weight",
              }),
            );
          }
        });
        exercises.push(...accessories(template.accessories, week === 4 ? 2 : undefined));
        out.push({
          key: `main-c${cycle}-w${week}-d${i + 1}`,
          title: template.title,
          phase: "main",
          week,
          day: i + 1,
          guidance:
            week === 4
              ? "Deload: light and easy, then go home feeling fresh."
              : settings.waveStyle === "classic"
                ? "Last main set of each lift: as many good reps as you can, stopping with 1 or 2 left in the tank."
                : "Every set is 5 smooth reps. You should finish each set feeling you could do 2 or 3 more.",
          exercises,
        });
      });
    }
    return out;
  },
};
