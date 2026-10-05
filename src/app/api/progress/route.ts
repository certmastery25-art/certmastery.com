import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) return NextResponse.json({ error: "Sign in to view saved progress." }, { status: 401 });

  const certifications = await prisma.certification.findMany({
    orderBy: { name: "asc" },
    include: {
      domains: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            select: { id: true, attempts: { where: { userId: session.user.id }, select: { isCorrect: true } } },
          },
        },
      },
      quizzes: {
        where: { userId: session.user.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: { id: true, mode: true, totalQuestions: true, correctAnswers: true, startedAt: true, completedAt: true },
      },
    },
  });

  return NextResponse.json(certifications.map((certification) => {
    const attempts = certification.domains.flatMap((domain) => domain.questions.flatMap((question) => question.attempts));
    const seen = new Set(certification.domains.flatMap((domain) => domain.questions.filter((question) => question.attempts.length > 0).map((question) => question.id)));
    return {
      id: certification.id,
      slug: certification.slug,
      acronym: certification.acronym,
      name: certification.name,
      examCode: certification.examCode,
      color: certification.color,
      questionsAnswered: attempts.length,
      uniqueQuestionsAnswered: seen.size,
      correctAnswers: attempts.filter((attempt) => attempt.isCorrect).length,
      accuracy: attempts.length ? Math.round((attempts.filter((attempt) => attempt.isCorrect).length / attempts.length) * 100) : 0,
      domains: certification.domains.map((domain) => {
        const domainAttempts = domain.questions.flatMap((question) => question.attempts);
        return {
          id: domain.id,
          name: domain.name,
          objective: domain.objective,
          questionsAnswered: domainAttempts.length,
          accuracy: domainAttempts.length ? Math.round((domainAttempts.filter((attempt) => attempt.isCorrect).length / domainAttempts.length) * 100) : 0,
        };
      }),
      history: certification.quizzes,
    };
  }));
}