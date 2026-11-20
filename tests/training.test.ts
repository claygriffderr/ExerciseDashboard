import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLATES, loadOptions, nearestBarbellLoad, platesForSide, roundToIncrement } from "../src/lib/training/plates";
import { DEFAULT_GEAR, loadableWeight } from "../src/lib/training/equipment";
import {
  estimateOneRepMax,
  missedMinimumReps,
  nextTrainingMax,
  trainingMaxFromOneRepMax,
  workSets,
} from "../src/lib/training/five-three-one";
import { EXERCISES, getExercise, slotVariants } from "../src/lib/training/exercises";
import { PROGRAMS, getProgram } from "../src/lib/training/programs";
import { lowerTrainingMaxes, progressTrainingMaxes, trainingMaxFromTestSet } from "../src/lib/training/progress";
import { adviseAfterGap, moveDay, nextTrainingDays, projectSchedule, weekday } from "../src/lib/training/schedule";

describe("plates", () => {
  it("finds the fewest plates per side", () => {
    assert.deepEqual(platesForSide(45, DEFAULT_PLATES), [45]);
    assert.deepEqual(platesForSide(77.5, DEFAULT_PLATES), [45, 25, 5, 2.5]);
    assert.deepEqual(platesForSide(0, DEFAULT_PLATES), []);
  });

  it("says when a load can't be built", () => {
    assert.equal(platesForSide(46.25, DEFAULT_PLATES), null);
    assert.deepEqual(platesForSide(46.25, [...DEFAULT_PLATES, 1.25]), [45, 1.25]);
  });

  it("lists options around the target, closest first", () => {
    const opts = loadOptions(203, 45, DEFAULT_PLATES, 0.05);
    assert.equal(opts[0].total, 205);
    assert.equal(opts[0].diff, 2);
    assert.equal(opts[1].total, 200);
    assert.ok(opts.every((o) => Math.abs(o.diffPct) <= 0.05));
    assert.ok(opts.every((o) => o.total >= 45));
  });

  it("puts the lighter load first on a tie", () => {
    const opts = loadOptions(202.5, 45, DEFAULT_PLATES, 0.02);
    assert.deepEqual(opts.slice(0, 2).map((o) => o.total), [200, 205]);
  });

  it("always shows the nearest load on each side, even with zero tolerance", () => {
    const opts = loadOptions(203, 45, DEFAULT_PLATES, 0);
    assert.deepEqual(opts.map((o) => o.total).sort(), [200, 205]);
  });

  it("uses finer steps when small plates are available", () => {
    assert.equal(nearestBarbellLoad(152, 45, DEFAULT_PLATES), 150);
    assert.equal(nearestBarbellLoad(152, 45, [...DEFAULT_PLATES, 1.25]), 152.5);
  });

  it("never goes below the empty bar", () => {
    assert.equal(nearestBarbellLoad(30, 45, DEFAULT_PLATES), 45);
    assert.equal(loadOptions(30, 45, DEFAULT_PLATES)[0].total, 45);
  });

  it("rounds to increments, ties down", () => {
    assert.equal(roundToIncrement(26, 5), 25);
    assert.equal(roundToIncrement(27.5, 5), 25);
    assert.equal(roundToIncrement(28, 5), 30);
  });
});

describe("equipment", () => {
  it("rounds each kind of equipment sensibly", () => {
    assert.equal(loadableWeight(153.4, "barbell"), 155);
    assert.equal(loadableWeight(26, "dumbbell"), 25);
    assert.equal(loadableWeight(2, "dumbbell"), 5);
    assert.equal(loadableWeight(30, "kettlebell"), 26);
    assert.equal(loadableWeight(50, "bodyweight"), null);
    assert.equal(loadableWeight(0, "barbell"), null);
  });
});

describe("5/3/1 math", () => {
  it("estimates a max like the worked example (225 × 5 ≈ 262)", () => {
    assert.equal(Math.round(estimateOneRepMax(225, 5)), 262);
    assert.equal(estimateOneRepMax(300, 1), 300);
    assert.equal(Math.round(trainingMaxFromOneRepMax(262.46)), 236);
  });

  it("builds the wave and the gentler steady-5s version", () => {
    assert.deepEqual(
      workSets(1).map((s) => [s.percent, s.reps, !!s.amrap]),
      [
        [0.65, 5, false],
        [0.75, 5, false],
        [0.85, 5, true],
      ],
    );
    assert.deepEqual(workSets(3).map((s) => s.reps), [5, 3, 1]);
    assert.ok(workSets(3, "fives-pro").every((s) => s.reps === 5 && !s.amrap));
    assert.deepEqual(workSets(4, "fives-pro").map((s) => s.percent), [0.4, 0.5, 0.6]);
  });

  it("progresses upper by 5 and lower by 10, or resets 10% after a miss", () => {
    assert.equal(nextTrainingMax(100, "bench"), 105);
    assert.equal(nextTrainingMax(200, "squat"), 210);
    const { next, changes } = progressTrainingMaxes(
      { squat: 200, bench: 100 },
      { squat: { missedReps: true } },
      { upper: 5, lower: 10 },
    );
    assert.deepEqual(next, { squat: 180, bench: 105 });
    assert.equal(changes.find((c) => c.slot === "squat")?.reason, "reset");
    assert.equal(missedMinimumReps(1, 4), true);
    assert.equal(missedMinimumReps(3, 1), false);
  });

  it("turns a comfortable test set into a conservative training max", () => {
    // 50 lb × 5 with 2 in reserve ≈ 61.7 lb max; 85% ≈ 52.4; rounded down to 50.
    assert.equal(trainingMaxFromTestSet(50, 5, 2, 0.85), 50);
    assert.equal(trainingMaxFromTestSet(135, 5, 2, 0.85), 140);
  });

  it("lowers training maxes after a long break", () => {
    assert.deepEqual(lowerTrainingMaxes({ squat: 200, press: 95 }, 0.1), { squat: 180, press: 85 });
  });
});

describe("exercise catalog", () => {
  it("has unique slugs and complete entries", () => {
    assert.equal(new Set(EXERCISES.map((e) => e.slug)).size, EXERCISES.length);
    for (const e of EXERCISES) {
      assert.ok(e.primary.length > 0, e.slug);
      assert.ok(e.cues.length >= 2, e.slug);
      assert.ok(e.description.length > 40, e.slug);
      assert.equal(e.category === "MAIN_LIFT", !!e.slot, e.slug);
    }
  });

  it("offers a beginner-friendly option for every main lift", () => {
    for (const slot of ["squat", "bench", "deadlift", "press"] as const) {
      assert.ok(slotVariants(slot).length >= 2, slot);
      assert.ok(slotVariants(slot).some((e) => e.beginnerFriendly), slot);
    }
  });
});

describe("programs", () => {
  const tms = { squat: 200, bench: 150, deadlift: 250, press: 100 };

  it("Standard 5/3/1 offers three volume levels", () => {
    const p = getProgram("standard")!;
    const build = (supplemental: "bbb" | "fsl" | "none") =>
      p.buildCycle({ settings: { ...p.defaultSettings, supplemental }, trainingMaxes: tms, gear: DEFAULT_GEAR, cycle: 1 })[0];
    const fsl = build("fsl").exercises.find((e) => e.section === "SUPPLEMENTAL")!;
    assert.deepEqual(fsl.sets.map((s) => [s.reps, s.weight]), Array(5).fill([5, 65]));
    assert.equal(build("none").exercises.some((e) => e.section === "SUPPLEMENTAL"), false);
    assert.equal(p.options.find((o) => o.key === "supplementalPercent")?.showWhen?.({ ...p.defaultSettings, supplemental: "fsl" }), false);
  });

  it("Boring But Big: 4 sessions a week, deload optional", () => {
    const p = getProgram("standard")!;
    const cycle = p.buildCycle({ settings: p.defaultSettings, trainingMaxes: tms, gear: DEFAULT_GEAR, cycle: 1 });
    assert.equal(cycle.length, 16);
    const noDeload = p.buildCycle({
      settings: { ...p.defaultSettings, includeDeload: false },
      trainingMaxes: tms,
      gear: DEFAULT_GEAR,
      cycle: 1,
    });
    assert.equal(noDeload.length, 12);

    const pressDay = cycle[0];
    assert.equal(pressDay.title, "Press day");
    const main = pressDay.exercises.find((e) => e.section === "MAIN")!;
    assert.deepEqual(main.sets.map((s) => s.weight), [65, 75, 85]);
    assert.equal(main.sets[2].amrap, true);
    const bbb = pressDay.exercises.find((e) => e.section === "SUPPLEMENTAL")!;
    assert.equal(bbb.sets.length, 5);
    assert.ok(bbb.sets.every((s) => s.reps === 10 && s.weight === 50));

    const deload = cycle.filter((w) => w.week === 4);
    assert.ok(deload.every((w) => !w.exercises.some((e) => e.section === "SUPPLEMENTAL")));
  });

  it("Beginner on-ramp: practice, test, then full-body 5/3/1", () => {
    const p = getProgram("beginner-onramp")!;
    const intro = p.buildIntro({ settings: p.defaultSettings, gear: DEFAULT_GEAR });
    assert.equal(intro.filter((w) => w.phase === "learn").length, 6);
    assert.equal(intro.filter((w) => w.phase === "find").length, 2);
    // Practice sessions alternate A and B.
    assert.notEqual(intro[0].title, intro[1].title);
    // Practice and test sets leave reps in reserve and let the person pick the weight.
    for (const w of intro) {
      for (const e of w.exercises.filter((x) => x.section === "MAIN")) {
        assert.ok(e.sets.every((s) => s.weight === null && (s.repsInReserve ?? 0) >= 2));
      }
    }
    // The four lifts are all tested.
    const tested = intro.filter((w) => w.phase === "find").flatMap((w) => w.exercises.map((e) => e.slot));
    assert.deepEqual([...tested].sort(), ["bench", "deadlift", "press", "squat"]);

    const cycle = p.buildCycle({
      settings: p.defaultSettings,
      trainingMaxes: { squat: 50, bench: 30, deadlift: 60, press: 20 },
      gear: DEFAULT_GEAR,
      cycle: 1,
    });
    assert.equal(cycle.length, 9);
    const first = cycle[0];
    assert.deepEqual(first.exercises.filter((e) => e.section === "MAIN").map((e) => e.slot), ["squat", "bench"]);
    // Steady 5s by default: no all-out sets.
    assert.ok(cycle.every((w) => w.exercises.every((e) => e.sets.every((s) => !s.amrap))));
    // Dumbbell weights are rounded to 5 lb steps (per hand).
    const benchMain = first.exercises.find((e) => e.section === "MAIN" && e.slot === "bench")!;
    assert.ok(benchMain.sets.every((s) => s.weight !== null && s.weight % 5 === 0));
  });

  it("Beginner on-ramp with two days a week alternates A and B", () => {
    const p = getProgram("beginner-onramp")!;
    const settings = { ...p.defaultSettings, daysPerWeek: 2 };
    assert.equal(p.buildIntro({ settings, gear: DEFAULT_GEAR }).filter((w) => w.phase === "learn").length, 4);
    const cycle = p.buildCycle({ settings, trainingMaxes: tms, gear: DEFAULT_GEAR, cycle: 1 });
    assert.equal(cycle.length, 6);
  });

  it("builds with every variant of every lift, and only uses catalog exercises", () => {
    for (const p of PROGRAMS) {
      for (const slot of ["squat", "bench", "deadlift", "press"] as const) {
        for (const v of slotVariants(slot)) {
          const settings = { ...p.defaultSettings, variants: { ...p.defaultSettings.variants, [slot]: v.slug } };
          const all = [
            ...p.buildIntro({ settings, gear: DEFAULT_GEAR }),
            ...p.buildCycle({ settings, trainingMaxes: tms, gear: DEFAULT_GEAR, cycle: 2 }),
          ];
          for (const w of all) for (const e of w.exercises) assert.ok(getExercise(e.exerciseSlug));
          assert.equal(new Set(all.map((w) => w.key)).size, all.length, "workout keys are unique");
        }
      }
    }
  });
});

describe("workout queue scheduling", () => {
  // 2026-11-16 is a Monday.
  const MON = "2026-11-16";
  const weekdays = [1, 3, 5];
  const q = (...ids: string[]) => ids;

  it("fills the training days in order", () => {
    assert.equal(weekday(MON), 1);
    const s = projectSchedule(q("a", "b", "c", "d"), { trainingWeekdays: weekdays, today: MON });
    assert.deepEqual([...s.values()], ["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23"]);
  });

  it("moves a missed workout to the next training day without dropping it", () => {
    // Monday's workout wasn't done; on Wednesday it's still first in line.
    const s = projectSchedule(q("mon-workout", "next"), { trainingWeekdays: weekdays, today: "2026-11-18" });
    assert.equal(s.get("mon-workout"), "2026-11-18");
    assert.equal(s.get("next"), "2026-11-20");
  });

  it("skips days that already have a finished workout", () => {
    const s = projectSchedule(q("a"), { trainingWeekdays: weekdays, today: MON, busyDates: [MON] });
    assert.equal(s.get("a"), "2026-11-18");
  });

  it("uses days moved to and leaves out days moved off, keeping the order", () => {
    // Tue 17 is a rest day moved in; Wed 18 is a training day moved off.
    const changes = new Map([
      ["2026-11-17", "EXTRA" as const],
      ["2026-11-18", "OFF" as const],
    ]);
    const s = projectSchedule(q("a", "b", "c"), { trainingWeekdays: weekdays, today: MON, dayChanges: changes });
    assert.deepEqual([...s.values()], [MON, "2026-11-17", "2026-11-20"]);
  });

  it("never puts a workout on a day that already has a finished one, even a moved-to day", () => {
    const changes = new Map([["2026-11-17", "EXTRA" as const]]);
    const s = projectSchedule(q("a", "b"), {
      trainingWeekdays: weekdays,
      today: MON,
      busyDates: [MON, "2026-11-17"],
      dayChanges: changes,
    });
    assert.deepEqual([...s.values()], ["2026-11-18", "2026-11-20"]);
  });

  it("only uses added days when there are no usual training days", () => {
    const changes = new Map([["2026-11-19", "EXTRA" as const]]);
    const s = projectSchedule(q("a", "b"), { trainingWeekdays: [], today: MON, dayChanges: changes });
    assert.equal(s.get("a"), "2026-11-19");
    assert.equal(s.has("b"), false);
  });

  it("moves days, not workouts", () => {
    const none = new Map();
    // Off a usual day onto a rest day: the old day goes off, the new one is added.
    assert.deepEqual([...moveDay(none, MON, "2026-11-17", weekdays)].sort(), [
      [MON, "OFF"],
      ["2026-11-17", "EXTRA"],
    ]);
    // Onto a day that's already a training day: only the old day goes off.
    assert.deepEqual([...moveDay(none, MON, "2026-11-18", weekdays)], [[MON, "OFF"]]);
    // Off an added day: it's simply not added any more.
    assert.deepEqual([...moveDay(new Map([["2026-11-17", "EXTRA"]]), "2026-11-17", "2026-11-18", weekdays)], []);
    // Back onto a day moved off: it's a training day again.
    assert.deepEqual([...moveDay(new Map([[MON, "OFF"]]), "2026-11-18", MON, weekdays)], [["2026-11-18", "OFF"]]);
    // Same day: nothing changes.
    assert.deepEqual([...moveDay(none, MON, MON, weekdays)], []);
  });

  it("lists upcoming training days", () => {
    assert.deepEqual(nextTrainingDays(MON, [2, 4], 3), ["2026-11-17", "2026-11-19", "2026-11-24"]);
  });

  it("gives advice after time away", () => {
    assert.equal(adviseAfterGap("2026-11-10", MON).kind, "none");
    const twoWeeks = adviseAfterGap("2026-11-01", MON);
    assert.equal(twoWeeks.kind, "ease-back");
    const month = adviseAfterGap("2026-10-01", MON);
    assert.equal(month.kind, "reset");
    if (month.kind === "reset") assert.equal(month.options.find((o) => o.recommended)?.reduceBy, 0.1);
    assert.equal(adviseAfterGap(null, MON).kind, "none");
  });
});

describe("profile gear", async () => {
  const { gearFromProfile } = await import("../src/lib/training/profile-gear");
  it("reads saved plates and ignores bad data", () => {
    assert.deepEqual(gearFromProfile({ barWeight: 35, availablePlates: "[25,10,1.25]" }).plates, [25, 10, 1.25]);
    assert.equal(gearFromProfile({ barWeight: 35, availablePlates: "[25]" }).barWeight, 35);
    assert.deepEqual(gearFromProfile({ barWeight: 45, availablePlates: "not json" }).plates, DEFAULT_GEAR.plates);
    assert.deepEqual(gearFromProfile({ barWeight: 45, availablePlates: '[7, "x"]' }).plates, DEFAULT_GEAR.plates);
    assert.deepEqual(gearFromProfile(null), DEFAULT_GEAR);
  });
});
