import { prisma } from "@/lib/db";

/** Liveness check for Docker and uptime monitors. Reveals nothing but "ok". */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
