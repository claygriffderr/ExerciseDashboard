"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { checkInSchema } from "@/lib/log/checkin";
import { saveCheckIn, saveCheckInFeeling, type CheckInResult } from "@/lib/log/checkin-store";
import { FEELINGS } from "@/lib/log/schema";

const invalid: CheckInResult = { ok: false, error: "Something in that check-in wasn't valid. Reload the page and try again." };

/** Save the check-in page: feeling, tags and notes for one day. */
export async function saveCheckInAction(raw: unknown): Promise<CheckInResult> {
  const user = await requireUser();
  const parsed = checkInSchema.safeParse(raw);
  if (!parsed.success) {
    const notesIssue = parsed.error.issues.find((i) => i.path[0] === "notes");
    return notesIssue ? { ok: false, error: notesIssue.message } : invalid;
  }
  const result = await saveCheckIn(user.id, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const quickSchema = z.object({ date: checkInSchema.shape.date, feeling: z.enum(FEELINGS).nullable() });

/** One tap on the dashboard: just the feeling. */
export async function quickCheckInAction(date: string, feeling: string | null): Promise<CheckInResult> {
  const user = await requireUser();
  const parsed = quickSchema.safeParse({ date, feeling });
  if (!parsed.success) return invalid;
  const result = await saveCheckInFeeling(user.id, parsed.data.date, parsed.data.feeling);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
