import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentSession } from "@/lib/nse/session";
import { findOwnAttempt, finalizeAttempt, isPastDeadline } from "@/lib/nse/exams";
import { gradeResponse, isResponseShapeValid, responseSchema, toReveal, type GradableOption } from "@/lib/nse/grading";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  index: z.number().int().min(0).max(100),
  response: responseSchema.optional(),
  flagged: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response: denied } = await requireStudentSession();
  if (denied) return denied;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer." }, { status: 400 });

  const attempt = await findOwnAttempt(id, session.user.id);
  if (!attempt) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (attempt.submittedAt) return NextResponse.json({ error: "This exam has already been submitted." }, { status: 409 });
  if (isPastDeadline(attempt.deadlineAt)) {
    await finalizeAttempt(id);
    return NextResponse.json({ error: "Time is up. Your exam has been submitted.", code: "TIME_UP" }, { status: 409 });
  }

  const item = await prisma.nseExamItem.findUnique({
    where: { attemptId_sortOrder: { attemptId: id, sortOrder: parsed.data.index } },
    select: { id: true, answeredAt: true, question: { select: { type: true, explanation: true, technology: true, topic: true, reference: true, options: { select: { label: true, text: true, rationale: true, isCorrect: true, position: true, matchTo: true } } } } },
  });
  if (!item) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  if (parsed.data.flagged !== undefined) await prisma.nseExamItem.update({ where: { id: item.id }, data: { flagged: parsed.data.flagged } });
  const answer = parsed.data.response;
  if (answer === undefined) return NextResponse.json({ saved: true });

  const options = item.question.options as GradableOption[];
  if (!isResponseShapeValid(item.question.type, options, answer)) return NextResponse.json({ error: "That answer doesn't fit this question." }, { status: 400 });

  if (attempt.mode === "PRACTICE") {
    // Practice shows the answer straight away, so the first response is final.
    const isCorrect = gradeResponse(item.question.type, options, answer);
    const { count } = await prisma.nseExamItem.updateMany({ where: { id: item.id, answeredAt: null, attempt: { submittedAt: null } }, data: { response: answer as Prisma.InputJsonValue, isCorrect, answeredAt: new Date() } });
    if (!count) return NextResponse.json({ error: "This question has already been answered." }, { status: 409 });
    return NextResponse.json({ saved: true, isCorrect, reveal: toReveal({ ...item.question, options }) });
  }

  await prisma.nseExamItem.updateMany({ where: { id: item.id, attempt: { submittedAt: null } }, data: { response: answer as Prisma.InputJsonValue, answeredAt: new Date() } });
  return NextResponse.json({ saved: true });
}
