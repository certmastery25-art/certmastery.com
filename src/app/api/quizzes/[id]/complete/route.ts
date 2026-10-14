import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics/record";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);

  const quiz = await prisma.quizSession.findUnique({
    where: { id },
    include: {
      certification: { select: { slug: true } },
      attempts: {
        select: {
          id: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!quiz) {
    return NextResponse.json(
      { error: "Quiz session not found." },
      { status: 404 }
    );
  }

  if (
    session?.user.id !== quiz.userId &&
    quiz.userId !== null
  ) {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 403 }
    );
  }

  const completed = await prisma.quizSession.update({
    where: { id: quiz.id },
    data: {
      correctAnswers: quiz.attempts.filter(
        (attempt) => attempt.isCorrect
      ).length,
      completedAt: new Date(),
    },
    select: {
      id: true,
      totalQuestions: true,
      correctAnswers: true,
      completedAt: true,
    },
  });

  if (!quiz.completedAt) {
    await recordEvent({ type: "exam_finished", userId: quiz.userId, certSlug: quiz.certification.slug, mode: quiz.mode });
  }

  return NextResponse.json(completed);
}