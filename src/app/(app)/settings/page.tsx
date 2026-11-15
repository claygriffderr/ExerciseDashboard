import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanWizard } from "@/components/plan-wizard";
import { requireUser } from "@/lib/auth/dal";
import { draftFromPlan } from "@/lib/plan/draft";
import { getActivePlan, knownTrainingMaxes } from "@/lib/plan/store";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [plan, knownMaxes] = await Promise.all([getActivePlan(user.id), knownTrainingMaxes(user.id)]);
  if (!plan) redirect("/onboarding");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every choice from setup, with the same explanations. Changes apply to your upcoming workouts.
          </p>
        </div>
        <Link
          href="/onboarding?new=1"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line/40"
        >
          Start a new plan
        </Link>
      </div>
      <div className="mt-8">
        <PlanWizard
          mode="edit"
          initial={draftFromPlan(plan)}
          defaultTimezone={plan.timezone}
          knownMaxes={knownMaxes}
          current={{ programKey: plan.program.key, startDate: plan.startDate, mainPhaseStarted: plan.mainPhaseStarted }}
        />
      </div>
    </div>
  );
}
