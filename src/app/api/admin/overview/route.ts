import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { getOverview } from "@/lib/admin/queries";
import { describeRange, isoDay, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminNotFound();
  const params = new URL(request.url).searchParams;
  const range = parseRange(params);
  const overview = await getOverview(range);
  if (params.get("format") === "csv") return csvResponse(`overview-${isoDay(range.start)}.csv`, overview.series);
  return NextResponse.json({ range: describeRange(range), ...overview });
}
