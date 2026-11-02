import { NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/nse/session";
import { findOwnAttempt, finalizeAttempt, isPastDeadline } from "@/lib/nse/exams";
import { toPublicQuestion, toReveal, type GradableOption } from "@/lib/nse/grading";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OPTION_SELECT = { label: true, text: true, rationale: true, isCorrect: true, position: true, matchTo: true } as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireStudentSession();
  if (response) return response;
  const { id } = await params;
  let attempt = await findOwnAttempt(id, session.user.id);
  if (!attempt) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  if (!attempt.submittedAt && isPastDeadline(attempt.deadlineAt)) {
    await finalizeAttempt(id);
    attempt = (await findOwnAttempt(id, session.user.id))!;
  }
  const pathway = await prisma.nsePathway.findUnique({ where: { id: attempt.pathwayId }, select: { slug: true, title: true } });
  const summary = { id: attempt.id, mode: attempt.mode, totalQuestions: attempt.totalQuestions, correctAnswers: attempt.correctAnswers, startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt, submittedAt: attempt.submittedAt, serverNow: new Date(), pathway };

  if (attempt.submittedAt) {
    const items = await prisma.nseExamItem.findMany({
      where: { attemptId: id },
      orderBy: { sortOrder: "asc" },
      select: {
        response: true,
        isCorrect: true,
        flagged: true,
        question: { select: { type: true, prompt: true, exhibit: true, difficulty: true, explanation: true, technology: true, topic: true, reference: true, options: { select: OPTION_SELECT, orderBy: { label: "asc" } }, module: { select: { title: true, slug: true } } } },
      },
    });
    return NextResponse.json({
      attempt: summary,
      results: items.map((item) => ({
        response: item.response,
        isCorrect: item.isCorrect,
        flagged: item.flagged,
        type: item.question.type,
        prompt: item.question.prompt,
        exhibit: item.question.exhibit,
        difficulty: item.question.difficulty,
        module: item.question.module,
        ...toReveal({ ...item.question, options: item.question.options as GradableOption[] }),
      })),
    });
  }

  // Questions are loaded one at a time, so a browser only ever holds the question on screen.
  const index = Math.max(0, Number(new URL(request.url).searchParams.get("index")) || 0);
  const [statuses, current] = await Promise.all([
    prisma.nseExamItem.findMany({ where: { attemptId: id }, orderBy: { sortOrder: "asc" }, select: { answeredAt: true, flagged: true } }),
    prisma.nseExamItem.findUnique({
      where: { attemptId_sortOrder: { attemptId: id, sortOrder: index } },
      select: {
        sortOrder: true, optionOrder: true, response: true, flagged: true, answeredAt: true, isCorrect: true,
        question: { select: { type: true, prompt: true, exhibit: true, difficulty: true, explanation: true, technology: true, topic: true, reference: true, options: { select: OPTION_SELECT }, module: { select: { title: true, slug: true } } } },
      },
    }),
  ]);
  if (!current) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  const options = current.question.options as GradableOption[];
  const revealed = attempt.mode === "PRACTICE" && current.answeredAt;

  return NextResponse.json({
    attempt: summary,
    statuses: statuses.map((item) => ({ answered: Boolean(item.answeredAt), flagged: item.flagged })),
    index: current.sortOrder,
    question: toPublicQuestion({ ...current.question, options }, current.optionOrder),
    response: current.response,
    flagged: current.flagged,
    ...(revealed ? { isCorrect: current.isCorrect, reveal: toReveal({ ...current.question, options }) } : {}),
  });
}
