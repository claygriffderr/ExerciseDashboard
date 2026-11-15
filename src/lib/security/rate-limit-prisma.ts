import "server-only";
import { prisma } from "@/lib/db";
import type { RateLimitRule, RateLimitStore } from "./rate-limit";

export const prismaRateLimitStore: RateLimitStore = {
  async get(key) {
    return prisma.rateLimitBucket.findUnique({ where: { key } });
  },
  async start(key, resetAt) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    // Occasionally sweep out windows that have ended.
    if (Math.random() < 0.02) {
      await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
    }
  },
  async increment(key) {
    const row = await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return row.count;
  },
  async clear(key) {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  },
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const RULES = {
  /** Login attempts from one IP address (covers many accounts). */
  loginPerIp: { limit: 30, windowMs: FIFTEEN_MINUTES },
  /** Login attempts against one account. Cleared after a successful login. */
  loginPerEmail: { limit: 8, windowMs: FIFTEEN_MINUTES },
  /** New accounts from one IP address. */
  signupPerIp: { limit: 5, windowMs: ONE_HOUR },
} satisfies Record<string, RateLimitRule>;
