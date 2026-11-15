import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { PROGRAMS } from "@/lib/training/programs";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  await requireUser();
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Programs</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Both programs use Jim Wendler&apos;s 5/3/1 method: weights based on a training max a bit below your true max,
        a repeating four-week wave, and small, steady increases. Pick the one that matches where you are today. You
        can switch later.
      </p>
      <ul className="mt-8 grid gap-5 md:grid-cols-2">
        {PROGRAMS.map((p) => (
          <li key={p.key} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-xl font-semibold text-ink">{p.name}</h2>
            <p className="mt-1 font-medium text-accent">{p.tagline}</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              <span className="font-medium text-ink">Best for: </span>
              {p.audience}
            </p>
            <p className="mt-3 text-sm text-muted">
              {orList(p.daysPerWeekOptions)} days a week · {p.phases.length}{" "}
              {p.phases.length === 1 ? "phase" : "phases"}
            </p>
            <div className="mt-auto pt-5">
              <Link href={`/programs/${p.key}`} className="inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink hover:bg-accent-strong">
                Learn more
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function orList(items: number[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
