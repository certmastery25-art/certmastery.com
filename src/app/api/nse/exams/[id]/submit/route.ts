import { NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/nse/session";
import { recordEvent } from "@/lib/analytics/record";
import { findOwnAttempt, finalizeAttempt } from "@/lib/nse/exams";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireStudentSession();
  if (response) return response;
  const { id } = await params;
  const attempt = await findOwnAttempt(id, session.user.id);
  if (!attempt) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (!attempt.submittedAt) {
    await finalizeAttempt(id);
    await recordEvent({ type: "exam_finished", userId: session.user.id, mode: attempt.mode });
  }
  return NextResponse.json({ submitted: true });
}
