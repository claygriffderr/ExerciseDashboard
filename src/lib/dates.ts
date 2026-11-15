import type { DateStr } from "./training/schedule";

/** Today's calendar date in the given IANA time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now: Date = new Date()): DateStr {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(v: unknown): v is DateStr {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function formatLong(d: DateStr): string {
  return LONG.format(new Date(`${d}T00:00:00Z`));
}
export function formatShort(d: DateStr): string {
  return SHORT.format(new Date(`${d}T00:00:00Z`));
}
export function formatMonth(month: string): string {
  return MONTH.format(new Date(`${month}-01T00:00:00Z`));
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
