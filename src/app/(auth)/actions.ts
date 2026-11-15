"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { allowSignups, trustedProxyCount } from "@/lib/config";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { createSession, invalidateCurrentSession } from "@/lib/auth/session";
import { firstErrors, loginSchema, signupSchema, type FieldErrors } from "@/lib/auth/validation";
import { consume, formatRetryAfter } from "@/lib/security/rate-limit";
import { RULES, prismaRateLimitStore } from "@/lib/security/rate-limit-prisma";
import { clientIpFromForwardedFor, safeRedirectPath } from "@/lib/security/request";

export type AuthFormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  /** Echo non-secret fields back so the form keeps them after an error. */
  values?: { email?: string; displayName?: string };
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFromForwardedFor(h.get("x-forwarded-for"), trustedProxyCount());
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: field(formData, "email"), displayName: field(formData, "displayName") };

  if (!allowSignups()) {
    return { error: "New sign-ups are turned off on this server.", values };
  }

  const limit = await consume(prismaRateLimitStore, `signup:ip:${await clientIp()}`, RULES.signupPerIp);
  if (!limit.allowed) {
    return {
      error: `Too many new accounts from this network. Try again in ${formatRetryAfter(limit.retryAfterMs)}.`,
      values,
    };
  }

  const parsed = signupSchema.safeParse({
    displayName: values.displayName,
    email: values.email,
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  const { email, password, displayName } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists. Try logging in." }, values };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, profile: { create: {} } },
    select: { id: true },
  });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: field(formData, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: field(formData, "password") });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };
  const { email, password } = parsed.data;

  const ipLimit = await consume(prismaRateLimitStore, `login:ip:${await clientIp()}`, RULES.loginPerIp);
  const emailKey = `login:email:${email}`;
  const emailLimit = await consume(prismaRateLimitStore, emailKey, RULES.loginPerEmail);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const wait = Math.max(ipLimit.retryAfterMs, emailLimit.retryAfterMs);
    return { error: `Too many login attempts. Try again in ${formatRetryAfter(wait)}.`, values };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyAgainstDummy(password);
  if (!user || !ok) {
    return { error: "That email and password don't match an account.", values };
  }

  await prismaRateLimitStore.clear(emailKey);
  await createSession(user.id);
  redirect(safeRedirectPath(field(formData, "next")));
}

export async function logoutAction(): Promise<void> {
  await invalidateCurrentSession();
  redirect("/login");
}
