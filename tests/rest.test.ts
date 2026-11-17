import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatClock, formatDuration, parseRestSettings, REST_DEFAULTS, restAfterTick, restSettingsSchema } from "../src/lib/log/rest";

const ex = (name: string, exerciseId: string, section: "WARMUP" | "MAIN" | "SUPPLEMENTAL" | "ACCESSORY", done: boolean[]) => ({
  name,
  exerciseId,
  section,
  sets: done.map((d) => ({ done: d })),
});

describe("rest timer", () => {
  it("rests between sets of the same exercise with that section's time", () => {
    const list = [ex("Squat", "sq", "MAIN", [true, false, false])];
    assert.deepEqual(restAfterTick(list, 0), { key: "MAIN", label: "Before your next set" });
  });

  it("keeps the set rest when the same lift carries on (warm-up to main sets)", () => {
    const list = [ex("Squat", "sq", "WARMUP", [true, true, true]), ex("Squat", "sq", "MAIN", [false, false, false])];
    assert.deepEqual(restAfterTick(list, 0), { key: "WARMUP", label: "Before your main sets" });
  });

  it("uses the between-exercises time for a different exercise", () => {
    const list = [ex("Squat", "sq", "SUPPLEMENTAL", [true, true]), ex("Hanging leg raise", "hlr", "ACCESSORY", [false])];
    assert.deepEqual(restAfterTick(list, 0), { key: "BETWEEN", label: "Before Hanging leg raise" });
  });

  it("skips finished exercises and wraps to earlier ones done out of order", () => {
    const list = [ex("Row", "row", "ACCESSORY", [false]), ex("Squat", "sq", "MAIN", [true]), ex("Dip", "dip", "ACCESSORY", [true])];
    assert.deepEqual(restAfterTick(list, 1), { key: "BETWEEN", label: "Before Row" });
  });

  it("stops once every set is done", () => {
    const list = [ex("Squat", "sq", "MAIN", [true, true]), ex("Row", "row", "ACCESSORY", [true])];
    assert.equal(restAfterTick(list, 1), null);
  });

  it("reads saved settings with defaults for anything missing or broken", () => {
    assert.deepEqual(parseRestSettings("{}"), { enabled: true, seconds: REST_DEFAULTS });
    assert.deepEqual(parseRestSettings("not json"), { enabled: true, seconds: REST_DEFAULTS });
    const s = parseRestSettings(JSON.stringify({ enabled: false, seconds: { MAIN: 240, WARMUP: 99999, BETWEEN: "x" } }));
    assert.equal(s.enabled, false);
    assert.equal(s.seconds.MAIN, 240);
    assert.equal(s.seconds.WARMUP, REST_DEFAULTS.WARMUP);
    assert.equal(s.seconds.BETWEEN, REST_DEFAULTS.BETWEEN);
  });

  it("only accepts sensible durations from the browser", () => {
    assert.ok(restSettingsSchema.safeParse({ enabled: true, seconds: REST_DEFAULTS }).success);
    assert.ok(!restSettingsSchema.safeParse({ enabled: true, seconds: { ...REST_DEFAULTS, MAIN: 5 } }).success);
    assert.ok(!restSettingsSchema.safeParse({ enabled: true, seconds: { MAIN: 180 } }).success);
  });

  it("formats durations and the clock", () => {
    assert.equal(formatDuration(45), "45 s");
    assert.equal(formatDuration(90), "1½ min");
    assert.equal(formatDuration(180), "3 min");
    assert.equal(formatClock(125), "2:05");
    assert.equal(formatClock(0.2), "0:01");
    assert.equal(formatClock(-3), "0:00");
  });
});
