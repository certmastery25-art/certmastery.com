import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentSession } from "@/lib/nse/session";
import { recordEvent } from "@/lib/analytics/record";
import { PUBLISHED_QUESTION } from "@/lib/nse/exams";
import { selectWeighted, shuffle } from "@/lib/nse/selection";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  pathway: z.string().min(1).max(80),
  mode: z.enum(["PRACTICE", "MOCK", "READINESS"]),
  module: z.string().min(1).max(80).optional(),
  count: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  const { session, response } = await requireStudentSession();
  if (response) return response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid exam settings." }, { status: 400 });
  // Limits how quickly one account can page through the whole bank.
  const startedRecently = await prisma.nseExamAttempt.count({ where: { userId: session.user.id, startedAt: { gt: new Date(Date.now() - 3_600_000) } } });
  if (startedRecently >= 40) return NextResponse.json({ error: "You've started a lot of exams. Try again in a little while." }, { status: 429 });

  const { pathway: slug, mode, module: moduleSlug, count } = parsed.data;
  const pathway = await prisma.nsePathway.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, slug: true, mockQuestions: true, mockMinutes: true, modules: { where: { status: "PUBLISHED" }, select: { id: true, slug: true, weight: true } } },
  });
  if (!pathway) return NextResponse.json({ error: "Pathway not found." }, { status: 404 });
  const scoped = moduleSlug ? pathway.modules.find((item) => item.slug === moduleSlug) : undefined;
  if (moduleSlug && !scoped) return NextResponse.json({ error: "Module not found." }, { status: 404 });
  if (scoped && mode !== "PRACTICE") return NextResponse.json({ error: "Mock and readiness exams cover the whole syllabus." }, { status: 400 });

  // Only ids at this stage, so a large bank isn't loaded into memory.
  const candidates = await prisma.nseQuestion.findMany({
    where: { ...PUBLISHED_QUESTION, module: { ...PUBLISHED_QUESTION.module, pathwayId: pathway.id, ...(scoped ? { id: scoped.id } : {}) } },
    select: { id: true, moduleId: true },
  });
  if (!candidates.length) return NextResponse.json({ error: "No questions are available yet." }, { status: 404 });

  const wanted = mode === "PRACTICE" ? count ?? 10 : pathway.mockQuestions;
  const chosen = selectWeighted(candidates, new Map(pathway.modules.map((item) => [item.id, item.weight])), wanted);
  const labels = await prisma.nseOption.findMany({ where: { questionId: { in: chosen } }, select: { questionId: true, label: true } });
  const labelsByQuestion = new Map<string, string[]>();
  for (const row of labels) labelsByQuestion.set(row.questionId, [...(labelsByQuestion.get(row.questionId) ?? []), row.label]);

  // A short bank gets proportionally less time, keeping the same pace per question. Only mock exams are timed.
  const minutes = Math.max(5, Math.round((pathway.mockMinutes * chosen.length) / pathway.mockQuestions));
  const attempt = await prisma.nseExamAttempt.create({
    data: {
      userId: session.user.id,
      pathwayId: pathway.id,
      moduleId: scoped?.id,
      mode,
      totalQuestions: chosen.length,
      deadlineAt: mode === "MOCK" ? new Date(Date.now() + minutes * 60_000) : null,
      items: { create: chosen.map((questionId, sortOrder) => ({ questionId, sortOrder, optionOrder: shuffle(labelsByQuestion.get(questionId) ?? []) })) },
    },
    select: { id: true },
  });
  await recordEvent({ type: "exam_started", userId: session.user.id, certSlug: pathway.slug, mode });
  return NextResponse.json({ id: attempt.id }, { status: 201 });
}
