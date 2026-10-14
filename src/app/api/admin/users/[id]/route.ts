import { NextResponse } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { getUserDetail } from "@/lib/admin/queries";
import { describeRange, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";
const TABLES = ["timeline", "certs", "domains", "scores"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return adminNotFound();
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const range = parseRange(searchParams);
  const detail = await getUserDetail(range, id);
  if (!detail) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (searchParams.get("format") === "csv") {
    const table = searchParams.get("table") as (typeof TABLES)[number];
    if (!TABLES.includes(table)) return NextResponse.json({ error: "Unknown table." }, { status: 400 });
    return csvResponse(`user-${id}-${table}.csv`, detail[table] as Record<string, unknown>[]);
  }
  return NextResponse.json({ range: describeRange(range), ...detail });
}
