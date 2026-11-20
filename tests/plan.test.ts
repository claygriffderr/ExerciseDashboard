import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLong, isDateStr, todayIn } from "../src/lib/dates";
import {
  buildMonth,
  hasUpcomingDayChanges,
  lastTrainedDate,
  monthOf,
  projectQueue,
  shiftMonth,
  type CalendarData,
  type PerformedWorkout,
} from "../src/lib/plan/calendar";
import { moveDay } from "../src/lib/training/schedule";
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
      { id: "a", title: "A", phase: "main", weekNumber: 1 },
      { id: "b", title: "B", phase: "main", weekNumber: 1 },
      { id: "c", title: "C", phase: "main", weekNumber: 1 },
    ],
    performed: [
      { id: "x", title: "X", status: "COMPLETED", performedDate: "2026-11-11", phase: "main", weekNumber: 1 },
      { id: "y", title: "Y", status: "SKIPPED", performedDate: "2026-11-13", phase: "main", weekNumber: 1 },
    ],
    trainingWeekdays: [1, 3, 5],
    today: TODAY,
    startDate: "2026-11-09",
    dayChanges: [],
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
    assert.ok(projected.every((w) => w.earliestMove === TODAY));
  });

  it("puts workouts on moved-to days and marks them", () => {
    const moved = { ...base, dayChanges: [{ date: TODAY, kind: "OFF" as const }, { date: "2026-11-17", kind: "EXTRA" as const }] };
    const projected = projectQueue(moved);
    assert.deepEqual(
      projected.map((w) => [w.id, w.date, w.moved]),
      [
        ["a", "2026-11-17", true],
        ["b", "2026-11-18", false],
        ["c", "2026-11-20", false],
      ],
    );
    assert.equal(hasUpcomingDayChanges(moved), true);
    assert.equal(hasUpcomingDayChanges({ ...base, dayChanges: [{ date: "2026-11-02", kind: "OFF" }] }), false);
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
    assert.equal(day("2026-11-17").dayOff, false);
  });

  it("shows days moved off as days off, never missed", () => {
    const weeks = buildMonth("2026-11", {
      ...base,
      dayChanges: [
        { date: "2026-11-09", kind: "OFF" },
        { date: "2026-11-10", kind: "EXTRA" },
        { date: "2026-11-18", kind: "OFF" },
      ],
    });
    const day = (d: string) => weeks.flat().find((x) => x.date === d)!;
    assert.deepEqual([day("2026-11-09").dayOff, day("2026-11-09").missed, day("2026-11-09").isTrainingDay], [true, false, false]);
    assert.equal(day("2026-11-10").missed, true, "a past added day with nothing done");
    assert.equal(day("2026-11-18").dayOff, true);
    assert.equal(day("2026-11-18").workouts.length, 0);
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

/**
 * Clay's week: training on Tue, Thu and Sat, alternating Practice B and A.
 * 2026-11-17 is a Tuesday. The order of workouts never changes; moving one
 * only changes which days are training days.
 */
describe("moving and skipping workouts", () => {
  const TUE = "2026-11-17";
  const WED = "2026-11-18";
  const THU = "2026-11-19";
  const FRI = "2026-11-20";
  const SAT = "2026-11-21";
  const MON2 = "2026-11-23";
  const TUE2 = "2026-11-24";
  const THU2 = "2026-11-26";
  const done = (id: string, date: string, status: "COMPLETED" | "SKIPPED" = "COMPLETED"): PerformedWorkout => ({
    id,
    title: id,
    status,
    performedDate: date,
    phase: "intro",
    weekNumber: 1,
  });
  const week = (today: string, performed: PerformedWorkout[] = [], queue = ["B1", "A2", "B2", "A3"]): CalendarData => ({
    queue: queue.map((id) => ({ id, title: id, phase: "intro", weekNumber: 1 })),
    performed: [done("A1", TUE), ...performed],
    trainingWeekdays: [2, 4, 6],
    today,
    startDate: "2026-11-10",
    dayChanges: [],
  });
  /** Move the workout `id` to `to`, the way the app does. */
  const move = (data: CalendarData, id: string, to: string): CalendarData => {
    const from = projectQueue(data).find((w) => w.id === id)!.date;
    const changes = moveDay(new Map(data.dayChanges.map((c) => [c.date, c.kind])), from, to, data.trainingWeekdays);
    return { ...data, dayChanges: [...changes].map(([date, kind]) => ({ date, kind })) };
  };
  const plan = (data: CalendarData) => projectQueue(data).map((w) => `${w.id} ${w.date}`);
  const dayOf = (data: CalendarData, date: string) =>
    buildMonth(date.slice(0, 7), data)
      .flat()
      .find((d) => d.date === date)!;

  it("starts on the usual days", () => {
    assert.deepEqual(plan(week(WED)), [`B1 ${THU}`, `A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
  });

  it("moving a workout earlier clears its old day and keeps everything else where it was", () => {
    const moved = move(week(WED), "B1", WED);
    assert.deepEqual(plan(moved), [`B1 ${WED}`, `A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    const thursday = dayOf(moved, THU);
    assert.deepEqual([thursday.workouts.length, thursday.dayOff, thursday.isTrainingDay], [0, true, false]);
    assert.equal(projectQueue(moved)[0].moved, true, "shown as moved by you");

    // Clay does B1 on Wednesday. On Thursday nothing is planned, and Thursday
    // doesn't count as missed afterwards.
    const thursdayAfter = { ...moved, today: THU, performed: [...moved.performed, done("B1", WED)], queue: moved.queue.slice(1) };
    assert.deepEqual(plan(thursdayAfter), [`A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    assert.equal(dayOf({ ...thursdayAfter, today: FRI }, THU).missed, false);
  });

  it("moving a workout onto the next workout's day frees its old day and pushes the rest back one slot", () => {
    const today = week(THU, [done("B1", WED)], ["A2", "B2", "A3", "B3"]);
    const moved = move(today, "A2", SAT);
    assert.deepEqual(plan(moved), [`A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`, "B3 2026-11-28"]);
    assert.equal(dayOf(moved, THU).dayOff, true, "today reads as a day off, not a training day");
    assert.equal(dayOf(moved, THU).isTrainingDay, false);
  });

  it("moving a workout past another one keeps the order: the earlier day gets the moved workout", () => {
    const moved = move(week(WED), "B1", MON2);
    assert.deepEqual(plan(moved), [`B1 ${SAT}`, `A2 ${MON2}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    assert.equal(dayOf(moved, THU).dayOff, true);
  });

  it("moving a later slot before an earlier one: Wednesday gets Thursday's workout and so on", () => {
    const moved = move(week(WED), "A2", WED);
    assert.deepEqual(plan(moved), [`B1 ${WED}`, `A2 ${THU}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    assert.equal(dayOf(moved, SAT).dayOff, true);
  });

  it("moving a workout past several others", () => {
    const moved = move(week(WED), "B1", "2026-11-25");
    assert.deepEqual(plan(moved), [`B1 ${SAT}`, `A2 ${TUE2}`, `B2 2026-11-25`, `A3 ${THU2}`]);
  });

  it("dragging a workout back to a day off makes it a training day again", () => {
    const today = week(THU, [done("B1", WED)], ["A2", "B2", "A3"]);
    const there = move(today, "A2", SAT);
    const back = move(there, "A2", THU);
    assert.deepEqual(plan(back), [`A2 ${THU}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    assert.equal(dayOf(back, THU).dayOff, false);
    assert.equal(dayOf(back, SAT).dayOff, true, "Saturday is now the day moved off");
    // Restoring the usual days puts everything back.
    assert.deepEqual(plan({ ...back, dayChanges: [] }), [`A2 ${THU}`, `B2 ${SAT}`, `A3 ${TUE2}`]);
  });

  it("moving a workout off a day it was moved to doesn't leave that day behind", () => {
    const once = move(week(WED), "B1", WED);
    const twice = move(once, "B1", FRI);
    assert.deepEqual(plan(twice), [`B1 ${FRI}`, `A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    assert.equal(dayOf(twice, WED).isTrainingDay, false);
    assert.equal(dayOf(twice, THU).dayOff, true);
  });

  it("skipping a workout gives the next training day the next workout, and so on", () => {
    const skipped = week(THU, [done("B1", THU, "SKIPPED")], ["A2", "B2", "A3"]);
    assert.deepEqual(plan(skipped), [`A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    // Skipped ahead of time, on a rest day: the next workout takes its day.
    const early = week(WED, [done("B1", WED, "SKIPPED")], ["A2", "B2", "A3"]);
    assert.deepEqual(plan(early), [`A2 ${THU}`, `B2 ${SAT}`, `A3 ${TUE2}`]);
  });

  it("a missed workout moves to the next training day and the rest follow", () => {
    assert.deepEqual(plan(week(FRI)), [`B1 ${SAT}`, `A2 ${TUE2}`, `B2 ${THU2}`, "A3 2026-11-28"]);
  });

  it("doing the next workout today, ahead of its day, works like moving it to today", () => {
    // What completing does: move its planned day (Thursday) to today (Wednesday).
    const moved = move(week(WED), "B1", WED);
    const after = { ...moved, performed: [...moved.performed, done("B1", WED)], queue: moved.queue.slice(1) };
    assert.deepEqual(plan(after), [`A2 ${SAT}`, `B2 ${TUE2}`, `A3 ${THU2}`]);
    // Undoing it puts it back on today.
    assert.deepEqual(plan(moved)[0], `B1 ${WED}`);
  });
});
