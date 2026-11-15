import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLong, isDateStr, todayIn } from "../src/lib/dates";
import { buildMonth, lastTrainedDate, monthOf, projectQueue, shiftMonth, type CalendarData } from "../src/lib/plan/calendar";
import { relativeDay, workoutLabel } from "../src/lib/plan/describe";
import { draftFromPlan, draftToInput, newDraft, programDefaults } from "../src/lib/plan/draft";
import { parseStoredSettings, resolveSettings, trainingMaxFromEntry, validatePlan } from "../src/lib/plan/settings";
import { DEFAULT_GEAR } from "../src/lib/training/equipment";
import { getProgram } from "../src/lib/training/programs";
import { trainingMaxFromTestSet } from "../src/lib/training/progress";

const TODAY = "2026-11-16"; // a Monday

function standardInput(overrides: Record<string, unknown> = {}) {
  const draft = { ...newDraft(DEFAULT_GEAR), ...programDefaults(getProgram("standard")!), experienceLevel: "EXPERIENCED" as const };
  draft.lifts = {
    squat: { method: "oneRepMax", weight: "300", reps: "" },
    bench: { method: "recentSet", weight: "185", reps: "5" },
    deadlift: { method: "trainingMax", weight: "315", reps: "" },
    press: { method: "oneRepMax", weight: "135", reps: "" },
  };
  return { ...draftToInput(draft, "America/Chicago", TODAY), ...overrides };
}

describe("plan settings", () => {
  it("accepts a complete standard plan and works out training maxes", () => {
    const result = validatePlan(standardInput());
    assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
    assert.equal(result.plan.runIntro, false);
    assert.deepEqual(result.plan.trainingMaxes, { squat: 270, bench: 194, deadlift: 315, press: 121.5 });
    assert.equal(result.plan.settings.supplemental, "bbb");
  });

  it("explains what's missing, keyed by setup step", () => {
    const missing = validatePlan({ ...standardInput(), experienceLevel: null });
    assert.ok(!missing.ok);
    assert.equal(missing.errors.experienceLevel, "Choose your experience level.");

    const wrongDays = validatePlan(standardInput({ trainingWeekdays: [1, 3] }));
    assert.ok(!wrongDays.ok);
    assert.match(wrongDays.errors.trainingWeekdays, /exactly 4/);

    const noTest = validatePlan(standardInput({ startingWeights: { mode: "test", lifts: {} } }));
    assert.ok(!noTest.ok, "standard 5/3/1 has no test sessions");
    assert.ok(noTest.errors.startingWeights);

    const badVariant = validatePlan(standardInput({ variants: { ...programDefaults(getProgram("standard")!).variants, squat: "deadlift" } }));
    assert.ok(!badVariant.ok);
    assert.ok(badVariant.errors.variants);
  });

  it("runs the beginner learn and test phases when starting weights will be found", () => {
    const draft = { ...newDraft(DEFAULT_GEAR), experienceLevel: "NEW_TO_LIFTING" as const };
    const result = validatePlan(draftToInput(draft, "UTC", TODAY));
    assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
    assert.equal(result.plan.program.key, "beginner-onramp");
    assert.equal(result.plan.runIntro, true);
    assert.deepEqual(result.plan.trainingMaxes, {});
  });

  it("only keeps option values the program offers", () => {
    const program = getProgram("standard")!;
    const settings = resolveSettings(program, { daysPerWeek: 3, variants: program.defaultSettings.variants, options: { supplemental: "fsl", supplementalPercent: 0.99, waveStyle: "nope" } });
    assert.equal(settings.supplemental, "fsl");
    assert.equal(settings.supplementalPercent, 0.5);
    assert.equal(settings.waveStyle, "classic");
  });

  it("estimates training maxes from what people know", () => {
    assert.equal(trainingMaxFromEntry({ method: "trainingMax", weight: 200 }, 0.9), 200);
    assert.equal(trainingMaxFromEntry({ method: "oneRepMax", weight: 200 }, 0.9), 180);
    assert.equal(trainingMaxFromEntry({ method: "recentSet", weight: 100, reps: 10 }, 0.85), 113.5);
  });

  it("keeps light test-set numbers instead of rounding them away", () => {
    assert.equal(trainingMaxFromTestSet(15, 5, 2, 0.85), 15);
    assert.equal(trainingMaxFromTestSet(8, 5, 2, 0.85), 8);
    assert.equal(trainingMaxFromTestSet(135, 5, 2, 0.85), 140);
  });

  it("fills missing stored settings from the program defaults", () => {
    const program = getProgram("standard")!;
    const settings = parseStoredSettings(program, JSON.stringify({ supplemental: "none", variants: { squat: "front-squat" } }));
    assert.equal(settings.supplemental, "none");
    assert.equal(settings.variants.squat, "front-squat");
    assert.equal(settings.variants.bench, "bench-press");
    assert.equal(parseStoredSettings(program, "not json").supplemental, "bbb");
  });

  it("prefills Settings from a saved plan", () => {
    const program = getProgram("standard")!;
    const draft = draftFromPlan({
      experienceLevel: "EXPERIENCED",
      program,
      settings: program.defaultSettings,
      trainingWeekdays: [1, 2, 4, 5],
      startDate: "2026-11-02",
      gear: DEFAULT_GEAR,
      trainingMaxes: { squat: 250, bench: 180, deadlift: 300, press: 110 },
    });
    assert.equal(draft.mode, "enter");
    assert.deepEqual(draft.lifts.squat, { method: "trainingMax", weight: "250", reps: "5" });
    const result = validatePlan(draftToInput(draft, "UTC", TODAY));
    assert.ok(result.ok);
    assert.deepEqual(result.plan.trainingMaxes, { squat: 250, bench: 180, deadlift: 300, press: 110 });
  });
});

describe("calendar", () => {
  const base: CalendarData = {
    queue: [
      { id: "a", title: "A", pinnedDate: null, phase: "main", weekNumber: 1 },
      { id: "b", title: "B", pinnedDate: null, phase: "main", weekNumber: 1 },
      { id: "c", title: "C", pinnedDate: null, phase: "main", weekNumber: 1 },
    ],
    performed: [
      { id: "x", title: "X", status: "COMPLETED", performedDate: "2026-11-11", phase: "main", weekNumber: 1 },
      { id: "y", title: "Y", status: "SKIPPED", performedDate: "2026-11-13", phase: "main", weekNumber: 1 },
    ],
    trainingWeekdays: [1, 3, 5],
    today: TODAY,
    startDate: "2026-11-09",
  };

  it("projects the queue onto training days from today", () => {
    const projected = projectQueue(base);
    assert.deepEqual(
      projected.map((w) => [w.id, w.date, w.isNext]),
      [
        ["a", "2026-11-16", true],
        ["b", "2026-11-18", false],
        ["c", "2026-11-20", false],
      ],
    );
    assert.equal(projected[0].earliestMove, TODAY);
    assert.equal(projected[1].earliestMove, "2026-11-17", "can move to the rest day right after A");
  });

  it("puts a moved workout on its new day and lets later ones follow", () => {
    const moved = { ...base, queue: base.queue.map((q) => (q.id === "a" ? { ...q, pinnedDate: "2026-11-17" } : q)) };
    const projected = projectQueue(moved);
    assert.deepEqual(
      projected.map((w) => [w.id, w.date, w.pinned]),
      [
        ["a", "2026-11-17", true],
        ["b", "2026-11-18", false],
        ["c", "2026-11-20", false],
      ],
    );
  });

  it("waits for the start date", () => {
    const later = projectQueue({ ...base, startDate: "2026-11-25" });
    assert.equal(later[0].date, "2026-11-25");
  });

  it("lays out Sunday-first weeks with missed days marked", () => {
    const weeks = buildMonth("2026-11", base);
    assert.equal(weeks[0][0].date, "2026-11-01");
    assert.equal(weeks[0][0].inMonth, true);
    assert.ok(weeks.every((w) => w.length === 7));
    const day = (d: string) => weeks.flat().find((x) => x.date === d)!;
    assert.equal(day("2026-11-09").missed, true, "past training day with nothing done");
    assert.equal(day("2026-11-11").missed, false);
    assert.equal(day("2026-11-11").workouts[0].status, "COMPLETED");
    assert.equal(day("2026-11-13").workouts[0].status, "SKIPPED");
    assert.equal(day("2026-11-06").missed, false, "before the start date");
    assert.equal(day("2026-11-16").isToday, true);
    assert.equal(day("2026-11-16").workouts[0].id, "a");
    assert.equal(day("2026-11-17").workouts.length, 0);
    assert.equal(day("2026-11-17").isTrainingDay, false);
  });

  it("covers months that start on a Sunday or end on a Saturday", () => {
    const feb = buildMonth("2026-02", base);
    assert.equal(feb[0][0].date, "2026-02-01");
    assert.equal(feb.at(-1)!.at(-1)!.date, "2026-02-28");
    assert.equal(feb.length, 4);
  });

  it("finds the last day actually trained (skips don't count)", () => {
    assert.equal(lastTrainedDate(base.performed), "2026-11-11");
    assert.equal(lastTrainedDate([]), null);
  });

  it("steps between months", () => {
    assert.equal(monthOf(TODAY), "2026-11");
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
  });
});

describe("dates and labels", () => {
  it("works out today in the person's time zone", () => {
    const late = new Date("2026-11-17T03:30:00Z"); // 9:30 pm the day before in Chicago
    assert.equal(todayIn("America/Chicago", late), "2026-11-16");
    assert.equal(todayIn("Asia/Tokyo", late), "2026-11-17");
    assert.equal(todayIn("Not/AZone", late), "2026-11-17");
  });

  it("validates dates", () => {
    assert.ok(isDateStr("2026-02-28"));
    assert.ok(!isDateStr("2026-02-30"));
    assert.ok(!isDateStr("2026-2-3"));
    assert.equal(formatLong("2026-11-16"), "Monday, November 16");
  });

  it("describes workouts in plain words", () => {
    const beginner = getProgram("beginner-onramp")!;
    assert.equal(workoutLabel(beginner, "learn", 2), "Learn the lifts · Week 2");
    assert.equal(workoutLabel(beginner, "find", 1), "Find your starting weights");
    assert.equal(workoutLabel(beginner, "main", 3), "5/3/1 for Beginners · 5/3/1 week");
    assert.equal(relativeDay(TODAY, TODAY), "Today");
    assert.equal(relativeDay("2026-11-17", TODAY), "Tomorrow");
    assert.equal(relativeDay("2026-11-20", TODAY), "Friday, November 20");
  });
});
