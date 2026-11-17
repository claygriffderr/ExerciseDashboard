import "server-only";
import { prisma } from "@/lib/db";
import { isDateStr, todayIn } from "@/lib/dates";
import { getActivePlan } from "@/lib/plan/store";
import type { Feeling } from "./schema";
import { isEmptyCheckIn, normalizeTags, parseTags, type CheckIn, type CheckInInput } from "./checkin";

export type CheckInResult = { ok: true } | { ok: false; error: string };

/** Today in the person's own time zone. */
export async function userToday(userId: string): Promise<string> {
  const plan = await getActivePlan(userId);
  if (plan) return plan.today;
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
  return todayIn(profile?.timezone ?? "UTC");
}

function toCheckIn(row: { date: string; feeling: Feeling | null; tags: string; notes: string | null }): CheckIn {
  return { date: row.date, feeling: row.feeling, tags: parseTags(row.tags), notes: row.notes };
}

export async function getCheckIn(userId: string, date: string): Promise<CheckIn | null> {
  const row = await prisma.dayCheckIn.findUnique({ where: { userId_date: { userId, date } } });
  return row ? toCheckIn(row) : null;
}

/** Check-ins between two dates (inclusive), oldest first. */
export async function listCheckIns(userId: string, range: { from?: string | null; to?: string | null } = {}): Promise<CheckIn[]> {
  const rows = await prisma.dayCheckIn.findMany({
    where: { userId, date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } },
    orderBy: { date: "asc" },
  });
  return rows.map(toCheckIn);
}

/** Why a day can't take a check-in, or null if it can. */
async function blockedReason(userId: string, date: string): Promise<string | null> {
  if (!isDateStr(date)) return "That date isn't valid.";
  if (date > (await userToday(userId))) return "You can check in for today or earlier days.";
  const trained = await prisma.workout.count({ where: { userId, status: "COMPLETED", performedDate: date } });
  if (trained > 0) return "You finished a workout that day, so its log already records how you felt.";
  return null;
}

/** Save a full check-in. Clearing everything removes it. */
export async function saveCheckIn(userId: string, input: CheckInInput): Promise<CheckInResult> {
  const blocked = await blockedReason(userId, input.date);
  if (blocked) return { ok: false, error: blocked };
  const key = { userId_date: { userId, date: input.date } };
  if (isEmptyCheckIn(input)) {
    await prisma.dayCheckIn.deleteMany({ where: { userId, date: input.date } });
    return { ok: true };
  }
  const data = {
    feeling: input.feeling,
    tags: JSON.stringify(normalizeTags(input.tags)),
    notes: input.notes.trim() ? input.notes.trim() : null,
  };
  await prisma.dayCheckIn.upsert({ where: key, create: { userId, date: input.date, ...data }, update: data });
  return { ok: true };
}

/** One-tap feeling from the dashboard. Tags and notes already saved stay as they are. */
export async function saveCheckInFeeling(userId: string, date: string, feeling: Feeling | null): Promise<CheckInResult> {
  const current = await getCheckIn(userId, date);
  return saveCheckIn(userId, {
    date,
    feeling,
    tags: current?.tags ?? [],
    notes: current?.notes ?? "",
  });
}
