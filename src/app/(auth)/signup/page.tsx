import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { allowSignups } from "@/lib/config";
import { AuthCard } from "../auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  if (!allowSignups()) {
    return (
      <AuthCard title="Sign-ups are closed" subtitle="This server isn't accepting new accounts right now.">
        <p className="text-center text-sm text-muted">
          Ask the person who runs it to open sign-ups, or{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            log in
          </Link>{" "}
          if you already have an account.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Next you'll set up a program that fits you.">
      <SignupForm minPasswordLength={PASSWORD_MIN_LENGTH} />
    </AuthCard>
  );
}
