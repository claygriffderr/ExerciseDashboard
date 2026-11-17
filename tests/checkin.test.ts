import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildExport } from "../src/lib/log/export";
import {
  canCheckIn,
  checkInDayKind,
  checkInSchema,
  isEmptyCheckIn,
  normalizeTags,
  parseTags,
} from "../src/lib/log/checkin";
import { buildMonth, type CalendarData } from "../src/lib/plan/calendar";

const TODAY = "2026-11-16"; // a Monday

describe("rest-day check-ins", () => {
  const kind = (date: string, workouts: { status: "PLANNED" | "COMPLETED" | "SKIPPED" }[] = [], isTrainingDay = false) =>
    checkInDayKind({ date, today: TODAY, isTrainingDay, startDate: "2026-11-02", workouts });

  it("works out what kind of day it is", () => {
    assert.equal(kind("2026-11-15"), "rest");
    assert.equal(kind(TODAY), "rest");
    assert.equal(kind("2026-11-17"), "future");
    assert.equal(kind("2026-11-13", [], true), "missed");
    assert.equal(kind(TODAY, [], true), "rest", "today isn't missed yet");
    assert.equal(kind("2026-10-30", [], true), "rest", "before the plan started");
    assert.equal(kind("2026-11-13", [{ status: "SKIPPED" }], true), "skipped");
    assert.equal(kind("2026-11-13", [{ status: "SKIPPED" }, { status: "COMPLETED" }], true), "trained");
    assert.equal(kind(TODAY, [{ status: "PLANNED" }], true), "planned");
  });

  it("only offers check-ins on days without a workout to log", () => {
    assert.ok(canCheckIn("rest"));
    assert.ok(canCheckIn("missed"));
    assert.ok(canCheckIn("skipped"));
    assert.ok(!canCheckIn("trained"));
    assert.ok(!canCheckIn("planned"));
    assert.ok(!canCheckIn("future"));
  });

  it("keeps tags clean and in order", () => {
    assert.deepEqual(parseTags('["TIRED","nope","RESTED","TIRED"]'), ["RESTED", "TIRED"]);
    assert.deepEqual(parseTags("not json"), []);
    assert.deepEqual(parseTags(null), []);
    assert.deepEqual(normalizeTags(["ACTIVE", "SORE", "ACTIVE"]), ["SORE", "ACTIVE"]);
  });

  it("validates input and spots an empty check-in", () => {
    assert.ok(checkInSchema.safeParse({ date: TODAY, feeling: "GOOD", tags: ["SORE"], notes: "" }).success);
    assert.ok(!checkInSchema.safeParse({ date: TODAY, feeling: "MEH", tags: [], notes: "" }).success);
    assert.ok(!checkInSchema.safeParse({ date: TODAY, feeling: null, tags: ["HUNGRY"], notes: "" }).success);
    assert.ok(!checkInSchema.safeParse({ date: "11/16/2026", feeling: null, tags: [], notes: "" }).success);
    assert.ok(!checkInSchema.safeParse({ date: TODAY, feeling: null, tags: [], notes: "x".repeat(5001) }).success);
    assert.ok(isEmptyCheckIn({ feeling: null, tags: [], notes: "  " }));
    assert.ok(!isEmptyCheckIn({ feeling: null, tags: ["RESTED"], notes: "" }));
  });

  it("shows check-ins on the calendar and offers them on the right days", () => {
    const data: CalendarData = {
      queue: [{ id: "a", title: "A", pinnedDate: null, phase: "main", weekNumber: 1 }],
      performed: [
        { id: "x", title: "X", status: "COMPLETED", performedDate: "2026-11-11", phase: "main", weekNumber: 1 },
        { id: "y", title: "Y", status: "SKIPPED", performedDate: "2026-11-13", phase: "main", weekNumber: 1 },
      ],
      trainingWeekdays: [1, 3, 5],
      today: "2026-11-17",
      startDate: "2026-11-09",
      checkIns: { "2026-11-10": "GOOD", "2026-11-12": null },
    };
    const day = (d: string) => buildMonth("2026-11", data).flat().find((x) => x.date === d)!;
    assert.deepEqual(day("2026-11-10").checkIn, { feeling: "GOOD" });
    assert.deepEqual(day("2026-11-12").checkIn, { feeling: null }, "notes only");
    assert.equal(day("2026-11-14").checkIn, null);
    assert.equal(day("2026-11-14").canCheckIn, true, "past rest day");
    assert.equal(day("2026-11-17").canCheckIn, true, "today, a rest day");
    assert.equal(day("2026-11-16").canCheckIn, true, "missed training day");
    assert.equal(day("2026-11-13").canCheckIn, true, "skipped workout");
    assert.equal(day("2026-11-11").canCheckIn, false, "trained");
    assert.equal(day("2026-11-18").canCheckIn, false, "future");
    assert.equal(day("2026-11-05").canCheckIn, false, "before the plan started");
  });

  it("are included in the export, with readable labels", () => {
    const out = buildExport({
      exportedAt: new Date("2026-11-20T12:00:00Z"),
      from: null,
      to: null,
      plan: null,
      trainingMaxHistory: [],
      workouts: [],
      checkIns: [
        { date: "2026-11-17", feeling: null, tags: [], notes: "Long walk" },
        { date: "2026-11-15", feeling: "COULD_BE_BETTER", tags: ["SORE", "TIRED"], notes: null },
      ],
    });
    assert.deepEqual(out.restDayCheckIns, [
      { date: "2026-11-15", feeling: "Could have been better", tags: ["Sore", "Tired"], notes: null },
      { date: "2026-11-17", feeling: null, tags: [], notes: "Long walk" },
    ]);
    assert.equal(out.summary.restDayCheckIns, 2);
    assert.deepEqual(out.range, { from: "2026-11-15", to: "2026-11-17" });
    assert.match(out.about, /restDayCheckIns/);
  });
});
