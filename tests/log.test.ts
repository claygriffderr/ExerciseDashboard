import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AI_PROMPT, buildExport, type ExportWorkoutRow } from "../src/lib/log/export";
import { resolveSet, toLog, workoutLogSchema } from "../src/lib/log/schema";

const target = { reps: 5, repsMax: null, weight: 135, amrap: false, percent: 0.65 };

describe("workout log", () => {
  it("fills a ticked set from the plan when nothing was typed", () => {
    assert.deepEqual(resolveSet({ weight: null, reps: null, done: true }, target), { weight: 135, reps: 5, done: true });
    assert.deepEqual(resolveSet({ weight: 140, reps: 4, done: true }, target), { weight: 140, reps: 4, done: true });
    assert.deepEqual(resolveSet({ weight: null, reps: null, done: false }, target), { weight: null, reps: null, done: false });
  });

  it("leaves AMRAP reps for the person to fill in", () => {
    assert.deepEqual(resolveSet({ weight: null, reps: null, done: true }, { ...target, amrap: true }), { weight: 135, reps: null, done: true });
  });

  it("turns the page's inputs into a valid log", () => {
    const log = toLog(
      [
        { id: "we1", exerciseId: "x", sets: [{ id: "s1", weight: "135", reps: "5", done: true }, { weight: "", reps: "abc", done: false }] },
        { exerciseId: "ex2", sets: [{ weight: "20.5", reps: "12", done: true }] },
      ],
      "GREAT",
      "Felt strong",
    );
    assert.deepEqual(log.exercises[0], {
      id: "we1",
      sets: [
        { id: "s1", weight: 135, reps: 5, done: true },
        { weight: null, reps: null, done: false },
      ],
    });
    assert.deepEqual(log.exercises[1], { exerciseId: "ex2", sets: [{ weight: 20.5, reps: 12, done: true }] });
    assert.ok(workoutLogSchema.safeParse(log).success);
  });

  it("rejects oversized notes and unknown feelings", () => {
    assert.ok(!workoutLogSchema.safeParse({ exercises: [], feeling: "MEH", notes: "" }).success);
    assert.ok(!workoutLogSchema.safeParse({ exercises: [], feeling: null, notes: "x".repeat(5001) }).success);
  });
});

describe("JSON export", () => {
  const set = (n: number, extra: Partial<ExportWorkoutRow["exercises"][number]["sets"][number]> = {}) => ({
    setNumber: n,
    targetReps: 5,
    targetRepsMax: null,
    targetWeight: 135,
    targetPercent: 0.65,
    targetRir: null,
    isAmrap: false,
    actualReps: null,
    actualWeight: null,
    completed: false,
    ...extra,
  });
  const rows: ExportWorkoutRow[] = [
    {
      performedDate: "2026-11-18",
      status: "SKIPPED",
      title: "Deadlift day",
      phase: "main",
      weekNumber: 1,
      feeling: null,
      notes: null,
      programName: "Standard 5/3/1",
      exercises: [{ name: "Deadlift", section: "MAIN", custom: false, equipment: "barbell", primaryMuscles: [], notes: null, sets: [set(1)] }],
    },
    {
      performedDate: "2026-11-16",
      status: "COMPLETED",
      title: "Squat day",
      phase: "main",
      weekNumber: 1,
      feeling: "GREAT",
      notes: "Slept well",
      programName: "Standard 5/3/1",
      exercises: [
        {
          name: "Back squat",
          section: "MAIN",
          custom: false,
          equipment: "barbell",
          primaryMuscles: ["Quads"],
          notes: null,
          sets: [set(2, { isAmrap: true, actualReps: 9, actualWeight: 135, completed: true }), set(1, { actualReps: 5, actualWeight: 135, completed: true })],
        },
        {
          name: "Sled push",
          section: "ACCESSORY",
          custom: true,
          equipment: "other",
          primaryMuscles: [],
          notes: null,
          sets: [{ ...set(1), targetReps: null, targetWeight: null, targetPercent: null, actualReps: 3, actualWeight: 90, completed: true }],
        },
      ],
    },
    { performedDate: null, status: "PLANNED", title: "Bench day", phase: "main", weekNumber: 1, feeling: null, notes: null, programName: null, exercises: [] },
  ];
  const out = buildExport({ exportedAt: new Date("2026-11-20T12:00:00Z"), from: null, to: null, plan: null, trainingMaxHistory: [], workouts: rows });

  it("lists finished and skipped workouts by date, leaving out planned ones", () => {
    assert.deepEqual(out.workouts.map((w) => [w.date, w.status]), [
      ["2026-11-16", "completed"],
      ["2026-11-18", "skipped"],
    ]);
    assert.deepEqual(out.summary, { workoutsCompleted: 1, workoutsSkipped: 1, withNotes: 1, restDayCheckIns: 0 });
    assert.deepEqual(out.range, { from: "2026-11-16", to: "2026-11-18" });
  });

  it("explains each set with what was planned and what was done", () => {
    const squat = out.workouts[0];
    assert.equal(squat.feeling, "Felt great!");
    assert.equal(squat.notes, "Slept well");
    const sets = squat.exercises[0].sets;
    assert.deepEqual(sets.map((s) => s.set), [1, 2]);
    assert.deepEqual(sets[1], {
      set: 2,
      planned: { reps: 5, weight: 135, percentOfTrainingMax: 65, asManyAsPossible: true },
      done: { weight: 135, reps: 9 },
      completed: true,
    });
    assert.deepEqual(squat.exercises[1].sets[0].planned, null);
    assert.equal(squat.exercises[1].custom, true);
  });

  it("doesn't pad skipped workouts with unlogged sets", () => {
    assert.deepEqual(out.workouts[1].exercises, []);
  });

  it("describes itself for an AI reader", () => {
    assert.equal(out.units, "lb");
    assert.match(out.about, /trainingMax/);
    assert.match(AI_PROMPT, /patterns/);
  });
});
