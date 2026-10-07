import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const quiz = await prisma.quizSession.findUnique({
    where: { id },
    include: {
      certification: { select: { name: true, examCode: true, slug: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            select: {
              id: true,
              prompt: true,
              difficulty: true,
              imageUrl: true,
              domain: { select: { id: true, name: true, objective: true } },
              options: { orderBy: { label: "asc" }, select: { label: true, text: true } },
            },
          },
        },
      },
      attempts: {
        select: {
          questionId: true,
          selectedLabel: true,
          isCorrect: true,
          question: { select: { explanation: true, options: { where: { isCorrect: true }, select: { label: true, text: true } } } },
        },
      },
    },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });
  if (quiz.userId && quiz.userId !== session?.user.id) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const { questions, attempts, ...details } = quiz;
  return NextResponse.json({
    quiz: details,
    questions: questions.map(({ question }) => question),
    answers: quiz.mode === "TIMED" && !quiz.completedAt
      ? attempts.map((attempt) => ({ questionId: attempt.questionId, selectedLabel: attempt.selectedLabel }))
      : attempts.map((attempt) => ({
      questionId: attempt.questionId,
      selectedLabel: attempt.selectedLabel,
      isCorrect: attempt.isCorrect,
      explanation: attempt.question.explanation,
      correctLabel: attempt.question.options[0]?.label,
      correctText: attempt.question.options[0]?.text,
      })),
  });
}