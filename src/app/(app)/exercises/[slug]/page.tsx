import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MuscleLegend, MuscleMap } from "@/components/muscle-map";
import { requireUser } from "@/lib/auth/dal";
import { EQUIPMENT_LABELS } from "@/lib/training/equipment";
import { EXERCISE_BY_SLUG, PATTERN_LABELS, slotVariants } from "@/lib/training/exercises";
import { LIFT_SLOTS } from "@/lib/training/five-three-one";
import { MUSCLE_LABELS } from "@/lib/training/muscles";

export async function generateMetadata({ params }: PageProps<"/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: EXERCISE_BY_SLUG.get(slug)?.name ?? "Exercise" };
}

export default async function ExercisePage({ params }: PageProps<"/exercises/[slug]">) {
  await requireUser();
  const { slug } = await params;
  const e = EXERCISE_BY_SLUG.get(slug);
  if (!e) notFound();
  const alternatives = e.slot ? slotVariants(e.slot).filter((v) => v.slug !== e.slug) : [];
  const slotLabel = e.slot ? LIFT_SLOTS.find((s) => s.slot === e.slot)?.label : undefined;

  return (
    <article>
      <Link href="/exercises" className="text-sm font-medium text-accent hover:underline">
        ← All exercises
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[1fr_280px]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{e.name}</h1>
          <p className="mt-1 text-muted">
            {PATTERN_LABELS[e.pattern]}
            {slotLabel && e.pattern === "main" ? ` (${slotLabel.toLowerCase()} slot)` : ""} · {EQUIPMENT_LABELS[e.equipment]}
            {e.equipment === "dumbbell" ? " · weights are per hand" : ""}
          </p>
          {e.beginnerFriendly && (
            <span className="mt-3 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-medium text-accent">
              Beginner friendly
            </span>
          )}
          <p className="mt-5 max-w-prose leading-7 text-ink">{e.description}</p>

          <h2 className="mt-8 text-lg font-semibold text-ink">How to do it</h2>
          <ol className="mt-3 max-w-prose space-y-3">
            {e.cues.map((cue, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
                  {i + 1}
                </span>
                <span className="leading-6 text-ink">{cue}</span>
              </li>
            ))}
          </ol>

          {e.easier && (
            <div className="mt-8 max-w-prose rounded-xl border border-line bg-surface p-4">
              <h2 className="font-semibold text-ink">Easier option</h2>
              <p className="mt-1 text-muted">{e.easier}</p>
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-ink">Other ways to fill the {slotLabel?.toLowerCase()} slot</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {alternatives.map((v) => (
                  <li key={v.slug}>
                    <Link href={`/exercises/${v.slug}`} className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-accent/60">
                      {v.name}
                      {v.beginnerFriendly ? " · beginner friendly" : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-line bg-surface p-5 md:self-start">
          <h2 className="font-semibold text-ink">Muscles worked</h2>
          <MuscleMap primary={e.primary} secondary={e.secondary} className="mt-3 w-full" title={`Muscles worked by ${e.name}`} />
          <div className="mt-3">
            <MuscleLegend />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-ink">Main</dt>
              <dd className="text-muted">{e.primary.map((m) => MUSCLE_LABELS[m]).join(", ")}</dd>
            </div>
            {e.secondary.length > 0 && (
              <div>
                <dt className="font-medium text-ink">Also working</dt>
                <dd className="text-muted">{e.secondary.map((m) => MUSCLE_LABELS[m]).join(", ")}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </article>
  );
}
