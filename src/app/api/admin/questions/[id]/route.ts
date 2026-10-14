import { NextResponse } from "next/server";
import { adminNotFound, getAdminSession } from "@/lib/admin/guard";
import { getQuestionDetail } from "@/lib/admin/queries";
import { describeRange, parseRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return adminNotFound();
  const { id } = await params;
  const range = parseRange(new URL(request.url).searchParams);
  const detail = await getQuestionDetail(range, id);
  if (!detail) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  return NextResponse.json({ range: describeRange(range), ...detail });
}
