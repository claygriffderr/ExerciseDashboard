import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanWizard } from "@/components/plan-wizard";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { newDraft } from "@/lib/plan/draft";
import { getActivePlan, knownTrainingMaxes } from "@/lib/plan/store";
import { gearFromProfile } from "@/lib/training/profile-gear";

export const metadata: Metadata = { title: "Set up your plan" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  const { new: startNew } = await searchParams;
  const [plan, profile, knownMaxes] = await Promise.all([
    getActivePlan(user.id),
    prisma.profile.findUnique({ where: { userId: user.id } }),
    knownTrainingMaxes(user.id),
  ]);
  // People with a plan change it in Settings, unless they chose to start over.
  if (plan && startNew !== "1") redirect("/settings");

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">{plan ? "New plan" : "Welcome"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
        {plan ? "Start a new plan" : "Let's set up your training"}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        {plan
          ? "Starting over replaces your upcoming workouts. Everything you've finished stays in your history."
          : "A few questions, each with an explanation, and you'll have a calendar of workouts made for you. It takes about five minutes."}
      </p>
      <div className="mt-8">
        <PlanWizard
          mode="new"
          initial={newDraft(gearFromProfile(profile))}
          defaultTimezone={profile?.timezone ?? "UTC"}
          knownMaxes={knownMaxes}
        />
      </div>
    </div>
  );
}
