import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { MAX_EXPORT_ROWS, getUsers } from "@/lib/admin/queries";
import { describeRange, isoDay, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminNotFound();
  const params = new URL(request.url).searchParams;
  const range = parseRange(params);
  const csv = params.get("format") === "csv";
  const options = {
    search: (params.get("q") ?? "").slice(0, 100),
    sort: params.get("sort") ?? "lastActive",
    direction: params.get("dir") ?? "desc",
    page: csv ? 1 : Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
    pageSize: csv ? MAX_EXPORT_ROWS : PAGE_SIZE,
  };
  const users = await getUsers(range, options);
  if (csv) return csvResponse(`users-${isoDay(range.start)}.csv`, users.rows);
  return NextResponse.json({ range: describeRange(range), ...users, page: options.page, pageSize: PAGE_SIZE });
}
