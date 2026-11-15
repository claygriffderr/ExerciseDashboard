import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeRedirectPath } from "@/lib/security/request";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = safeRedirectPath(Array.isArray(next) ? next[0] : next);
  if (await getCurrentUser()) redirect(target);

  return (
    <AuthCard title="Welcome back" subtitle="Log in to see your training plan.">
      <LoginForm next={target === "/dashboard" ? undefined : target} />
    </AuthCard>
  );
}
