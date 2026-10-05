import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const quiz = await prisma.quizSession.findUnique({
    where: { id: params.id },
    include: { attempts: { select: { id: true, isCorrect: true } } },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });
  if (session?.user.id !== quiz.userId && quiz.userId !== null) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const completed = await prisma.quizSession.update({
    where: { id: quiz.id },
    data: { correctAnswers: quiz.attempts.filter((attempt) => attempt.isCorrect).length, completedAt: new Date() },
    select: { id: true, totalQuestions: true, correctAnswers: true, completedAt: true },
  });
  return NextResponse.json(completed);
}