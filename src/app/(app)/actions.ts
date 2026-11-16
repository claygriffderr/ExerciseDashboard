"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { rebuildPlannedQueue } from "@/lib/plan/store";
import { ALL_PLATE_SIZES } from "@/lib/training/plates";
import { restSettingsSchema } from "@/lib/log/rest";

const plateSettingsSchema = z.object({
  barWeight: z.number().min(0).max(100),
  plates: z
    .array(z.number().refine((p) => ALL_PLATE_SIZES.includes(p), "Unknown plate size"))
    .min(1, "Choose at least one plate size.")
    .max(ALL_PLATE_SIZES.length),
});

export async function savePlateSettings(input: { barWeight: number; plates: number[] }): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = plateSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const plates = [...new Set(parsed.data.plates)].sort((a, b) => b - a);
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, barWeight: parsed.data.barWeight, availablePlates: JSON.stringify(plates) },
    update: { barWeight: parsed.data.barWeight, availablePlates: JSON.stringify(plates) },
  });
  // Planned weights are rounded to the plates, so refresh them.
  await rebuildPlannedQueue(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Save rest timer preferences. No page refresh: the workout page keeps its own copy. */
export async function saveRestSettings(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = restSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those rest times weren't valid. Reload the page and try again." };
  const restTimer = JSON.stringify(parsed.data);
  await prisma.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, restTimer }, update: { restTimer } });
  return { ok: true };
}
