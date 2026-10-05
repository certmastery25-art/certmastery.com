import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createQuizSchema = z.object({
  certification: z.string().min(1),
  mode: z.enum(["PRACTICE", "TIMED", "CUSTOM"]),
  count: z.number().int().min(1).max(100),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  domain: z.string().optional(),
  search: z.string().trim().max(120).optional(),
});

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createQuizSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid quiz settings." }, { status: 400 });

  const certification = await prisma.certification.findUnique({ where: { slug: parsed.data.certification } });
  if (!certification) return NextResponse.json({ error: "Certification not found." }, { status: 404 });

  const candidates = await prisma.question.findMany({
    where: {
      domain: { certificationId: certification.id, ...(parsed.data.domain ? { id: parsed.data.domain } : {}) },
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
      ...(parsed.data.search ? { prompt: { contains: parsed.data.search } } : {}),
    },
    select: {
      id: true,
      prompt: true,
      difficulty: true,
      imageUrl: true,
      domain: { select: { id: true, name: true, objective: true } },
      options: { orderBy: { label: "asc" }, select: { label: true, text: true } },
    },
  });

  if (candidates.length === 0) return NextResponse.json({ error: "No questions match these filters yet." }, { status: 404 });

  const questions = shuffle(candidates).slice(0, Math.min(parsed.data.count, candidates.length));
  const session = await getServerSession(authOptions);
  const quiz = await prisma.quizSession.create({
    data: {
      userId: session?.user.id,
      certificationId: certification.id,
      mode: parsed.data.mode,
      totalQuestions: questions.length,
      questions: { create: questions.map((question, sortOrder) => ({ questionId: question.id, sortOrder })) },
    },
    select: { id: true, startedAt: true },
  });

  return NextResponse.json({ quiz, questions, certification: { name: certification.name, examCode: certification.examCode } }, { status: 201 });
}