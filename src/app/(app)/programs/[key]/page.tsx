import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getProgram } from "@/lib/training/programs";
import { gearFromProfile } from "@/lib/training/profile-gear";
import { ProgramPreview } from "./program-preview";

export async function generateMetadata({ params }: PageProps<"/programs/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: getProgram(key)?.name ?? "Program" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="max-w-prose space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 leading-6 text-ink">
          <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ProgramPage({ params }: PageProps<"/programs/[key]">) {
  const user = await requireUser();
  const { key } = await params;
  const program = getProgram(key);
  if (!program) notFound();
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { barWeight: true, availablePlates: true },
  });

  return (
    <article>
      <Link href="/programs" className="text-sm font-medium text-accent hover:underline">
        ← All programs
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{program.name}</h1>
      <p className="mt-1 text-lg text-accent">{program.tagline}</p>
      <p className="mt-4 max-w-prose leading-7 text-ink">{program.summary}</p>
      <p className="mt-3 max-w-prose leading-7 text-muted">
        <span className="font-medium text-ink">Best for: </span>
        {program.audience}
      </p>

      {program.phases.length > 1 && (
        <Section title="How it unfolds">
          <ol className="grid gap-3 sm:grid-cols-3">
            {program.phases.map((phase, i) => (
              <li key={phase.key} className="rounded-2xl border border-line bg-surface p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">Phase {i + 1}</span>
                <h3 className="mt-1 font-semibold text-ink">{phase.name}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{phase.description}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Why it works">
        <Bullets items={program.benefits} />
      </Section>

      <Section title="What it involves">
        <Bullets items={program.whatItInvolves} />
      </Section>

      <Section title="Choices you'll make">
        <div className="grid gap-4 md:grid-cols-3">
          {program.options.map((o) => (
            <div key={o.key} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="font-semibold text-ink">{o.label}</h3>
              <p className="mt-1 text-sm text-muted">{o.explanation}</p>
              <ul className="mt-3 space-y-2">
                {o.choices.map((c) => (
                  <li key={String(c.value)} className="text-sm">
                    <span className="font-medium text-ink">{c.label}</span>
                    {c.recommended && (
                      <span className="ml-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">Suggested</span>
                    )}
                    <p className="text-muted">{c.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          You&apos;ll pick these, plus your training days and which version of each lift to use, when you set up your
          program. You can change them any time.
        </p>
      </Section>

      <Section title="Things to know">
        <Bullets items={program.thingsToKnow} />
      </Section>

      <Section title="Try it with your numbers">
        <ProgramPreview programKey={program.key} gear={gearFromProfile(profile)} />
      </Section>

      <Section title="Sources">
        <ul className="space-y-1 text-sm text-muted">
          {program.sources.map((s) => (
            <li key={s.label}>
              {s.url ? (
                <a href={s.url} className="text-accent hover:underline" rel="noreferrer noopener" target="_blank">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
