import { getCurrentUser } from "@/lib/auth/dal";
import { isDateStr } from "@/lib/dates";
import { buildExport } from "@/lib/log/export";
import { loadExportInput } from "@/lib/log/store";

/** Download the signed-in person's training history as JSON. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Log in to export your history." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  if ((from && !isDateStr(from)) || (to && !isDateStr(to))) {
    return Response.json({ error: "Dates must look like 2026-01-31." }, { status: 400 });
  }

  const data = buildExport(await loadExportInput(user.id, { from, to }));
  const stamp = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-history-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
