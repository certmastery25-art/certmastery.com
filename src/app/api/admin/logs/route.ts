import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { MAX_EXPORT_ROWS, MAX_ROWS, getLogs } from "@/lib/admin/queries";
import { describeRange, isoDay, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminNotFound();
  const params = new URL(request.url).searchParams;
  const range = parseRange(params);
  const csv = params.get("format") === "csv";
  const text = (name: string, max = 200) => params.get(name)?.trim().slice(0, max) || undefined;
  const limit = csv ? MAX_EXPORT_ROWS : Math.min(MAX_ROWS, Math.max(1, Number.parseInt(params.get("limit") ?? "100", 10) || 100));
  const logs = await getLogs(range, {
    type: text("type", 40),
    path: text("path"),
    status: text("status", 3),
    user: text("user"),
    cert: text("cert", 60),
    country: text("country", 2),
    cursor: text("cursor", 20),
    limit,
  });
  if (csv) return csvResponse(`events-${isoDay(range.start)}.csv`, logs.rows);
  return NextResponse.json({ range: describeRange(range), ...logs });
}
