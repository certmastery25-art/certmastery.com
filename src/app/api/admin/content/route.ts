import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { CONTENT_TABLES, MAX_EXPORT_ROWS, getContent, getContentTable, type ContentTable } from "@/lib/admin/queries";
import { describeRange, isoDay, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminNotFound();
  const params = new URL(request.url).searchParams;
  const range = parseRange(params);
  if (params.get("format") === "csv") {
    const table = params.get("table") as ContentTable;
    if (!CONTENT_TABLES.includes(table)) return NextResponse.json({ error: "Unknown table." }, { status: 400 });
    return csvResponse(`${table}-${isoDay(range.start)}.csv`, await getContentTable(range, table, MAX_EXPORT_ROWS) as Record<string, unknown>[]);
  }
  return NextResponse.json({ range: describeRange(range), ...(await getContent(range)) });
}
