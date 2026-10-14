import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { MAX_ROWS, getErrors } from "@/lib/admin/queries";
import { describeRange, isoDay, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminNotFound();
  const params = new URL(request.url).searchParams;
  const range = parseRange(params);
  const rows = await getErrors(range, MAX_ROWS);
  if (params.get("format") === "csv") return csvResponse(`errors-${isoDay(range.start)}.csv`, rows);
  return NextResponse.json({ range: describeRange(range), rows });
}
