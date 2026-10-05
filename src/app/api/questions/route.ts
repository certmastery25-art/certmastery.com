import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  certification: z.string().min(1),
  domain: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  search: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid question filters." }, { status: 400 });

  const certification = await prisma.certification.findUnique({ where: { slug: parsed.data.certification } });
  if (!certification) return NextResponse.json({ error: "Certification not found." }, { status: 404 });

  const questions = await prisma.question.findMany({
    where: {
      domain: {
        certificationId: certification.id,
        ...(parsed.data.domain ? { id: parsed.data.domain } : {}),
      },
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
      ...(parsed.data.search ? { OR: [
        { prompt: { contains: parsed.data.search } },
        { explanation: { contains: parsed.data.search } },
        { domain: { name: { contains: parsed.data.search } } },
      ] } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prompt: true,
      explanation: true,
      difficulty: true,
      imageUrl: true,
      domain: { select: { id: true, name: true, objective: true } },
      options: { orderBy: { label: "asc" }, select: { label: true, text: true } },
    },
  });

  return NextResponse.json(questions);
}