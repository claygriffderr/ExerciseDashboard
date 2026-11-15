import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { EXERCISES } from "@/lib/training/exercises";
import { ExerciseBrowser } from "./exercise-browser";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  await requireUser();
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Exercise library</h1>
      <p className="mt-2 max-w-2xl text-muted">
        How to do each exercise, which muscles it works, and an easier option where there is one. Exercises marked
        &ldquo;Beginner friendly&rdquo; are easy to learn and to start light.
      </p>
      <ExerciseBrowser exercises={EXERCISES} />
    </div>
  );
}
