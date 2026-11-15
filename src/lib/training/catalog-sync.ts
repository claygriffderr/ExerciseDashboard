import "server-only";
import { prisma } from "@/lib/db";
import { EXERCISES } from "./exercises";

/**
 * Make the database's built-in exercises match the catalog in code. Runs once
 * when the server starts. Custom exercises (with an owner) are never touched.
 */
export async function syncExerciseCatalog(): Promise<number> {
  for (const e of EXERCISES) {
    const data = {
      name: e.name,
      category: e.category,
      pattern: e.pattern,
      equipment: e.equipment,
      primaryMuscles: JSON.stringify(e.primary),
      secondaryMuscles: JSON.stringify(e.secondary),
      description: e.description,
      techniqueCues: JSON.stringify(e.cues),
    };
    await prisma.exercise.upsert({
      where: { slug: e.slug },
      create: { slug: e.slug, ...data },
      update: data,
    });
  }
  return EXERCISES.length;
}
