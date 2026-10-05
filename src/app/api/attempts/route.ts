import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedLabel: z.enum(["A", "B", "C", "D"]),
  quizSessionId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose one of the available answers." }, { status: 400 });

  const question = await prisma.question.findUnique({
    where: { id: parsed.data.questionId },
    include: { options: true },
  });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const chosen = question.options.find((option) => option.label === parsed.data.selectedLabel);
  const correctOption = question.options.find((option) => option.isCorrect);
  if (!chosen || !correctOption) return NextResponse.json({ error: "This question is not configured correctly." }, { status: 500 });

  const session = await getServerSession(authOptions);
  const quiz = parsed.data.quizSessionId
    ? await prisma.quizSession.findUnique({
      where: { id: parsed.data.quizSessionId },
      select: { id: true, userId: true, mode: true, completedAt: true, questions: { where: { questionId: question.id }, select: { id: true } } },
    })
    : null;
  if (parsed.data.quizSessionId && !quiz) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });
  if (quiz?.userId && quiz.userId !== session?.user.id) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (quiz?.completedAt) return NextResponse.json({ error: "This quiz is already complete." }, { status: 409 });
  if (quiz && quiz.questions.length === 0) return NextResponse.json({ error: "Question is not part of this quiz." }, { status: 400 });

  const priorAttempt = quiz ? await prisma.attempt.findFirst({ where: { quizSessionId: quiz.id, questionId: question.id } }) : null;
  if (priorAttempt) return NextResponse.json({ error: "This question has already been answered." }, { status: 409 });

  const isCorrect = chosen.isCorrect;
  await prisma.attempt.create({
    data: {
      userId: session?.user.id,
      quizSessionId: quiz?.id,
      questionId: question.id,
      selectedLabel: chosen.label,
      isCorrect,
    },
  });
  if (isCorrect && quiz) await prisma.quizSession.update({ where: { id: quiz.id }, data: { correctAnswers: { increment: 1 } } });

  if (quiz?.mode === "TIMED") return NextResponse.json({ recorded: true });

  return NextResponse.json({
    isCorrect,
    correctLabel: correctOption.label,
    explanation: question.explanation,
    correctText: correctOption.text,
  });
}