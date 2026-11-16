import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/training/equipment";
import { EXERCISES, PATTERN_LABELS, type MovementPattern } from "@/lib/training/exercises";
import { MUSCLE_LABELS, type Muscle } from "@/lib/training/muscles";
import { ExerciseBrowser } from "./exercise-browser";

export const metadata: Metadata = { title: "Exercises" };

function muscles(json: string): string {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((m): m is Muscle => typeof m === "string" && m in MUSCLE_LABELS).map((m) => MUSCLE_LABELS[m]).join(", ") : "";
  } catch {
    return "";
  }
}

export default async function ExercisesPage() {
  const user = await requireUser();
  const custom = await prisma.exercise.findMany({
    where: { ownerId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, pattern: true, equipment: true, primaryMuscles: true, description: true },
  });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Exercise library</h1>
      <p className="mt-2 max-w-2xl text-muted">
        How to do each exercise, which muscles it works, and an easier option where there is one. Exercises marked
        &ldquo;Beginner friendly&rdquo; are easy to learn and to start light.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-ink">Your exercises</h2>
        {custom.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            Need something that isn&apos;t here? Open any workout, choose <span className="font-medium text-ink">Add an exercise</span>,
            then <span className="font-medium text-ink">Create your own</span>. It&apos;s saved here for next time.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {custom.map((e) => (
              <li key={e.id} className="py-2.5 text-sm">
                <span className="font-medium text-ink">{e.name}</span>
                <span className="text-muted">
                  {" "}
                  · {PATTERN_LABELS[e.pattern as MovementPattern] ?? e.pattern}
                  {e.equipment && e.equipment in EQUIPMENT_LABELS ? ` · ${EQUIPMENT_LABELS[e.equipment as Equipment]}` : ""}
                  {muscles(e.primaryMuscles) ? ` · ${muscles(e.primaryMuscles)}` : ""}
                </span>
                {e.description && <p className="mt-0.5 text-muted">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExerciseBrowser exercises={EXERCISES} />
    </div>
  );
}
