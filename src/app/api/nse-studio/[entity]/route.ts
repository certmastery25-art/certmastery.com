import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminNotFound } from "@/lib/admin/guard";
import { getEditorSession, labSchema, mayPublish, moduleSchema, pathwaySchema, questionSchema } from "@/lib/nse/studio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const invalid = (error: z.ZodError) => NextResponse.json({ error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
const forbidden = () => NextResponse.json({ error: "Only an administrator can publish content." }, { status: 403 });

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  if (!(await getEditorSession())) return adminNotFound();
  const { entity } = await params;
  const url = new URL(request.url);
  if (entity === "questions") {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const where: Prisma.NseQuestionWhereInput = {
      ...(url.searchParams.get("moduleId") ? { moduleId: url.searchParams.get("moduleId")! } : {}),
      ...(url.searchParams.get("pathwayId") ? { module: { pathwayId: url.searchParams.get("pathwayId")! } } : {}),
      ...(url.searchParams.get("status") ? { status: url.searchParams.get("status") as Prisma.EnumNseContentStatusFilter["equals"] } : {}),
    };
    const [questions, total] = await Promise.all([
      prisma.nseQuestion.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { options: { orderBy: { label: "asc" } }, module: { select: { title: true } } } }),
      prisma.nseQuestion.count({ where }),
    ]);
    const stats = await prisma.nseExamItem.groupBy({ by: ["questionId", "isCorrect"], where: { questionId: { in: questions.map((question) => question.id) }, isCorrect: { not: null } }, _count: true });
    return NextResponse.json({
      total, page, pageSize: PAGE_SIZE,
      questions: questions.map((question) => {
        const rows = stats.filter((row) => row.questionId === question.id);
        const correct = rows.find((row) => row.isCorrect)?._count ?? 0;
        const answered = rows.reduce((sum, row) => sum + row._count, 0);
        return { ...question, answered, correctRate: answered ? Math.round((correct / answered) * 100) : null };
      }),
    });
  }
  return adminNotFound();
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const session = await getEditorSession();
  if (!session) return adminNotFound();
  const { entity } = await params;
  const body = await request.json().catch(() => null);
  const role = session.user.role;

  if (entity === "pathways") {
    const parsed = pathwaySchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status)) return forbidden();
    return NextResponse.json(await prisma.nsePathway.create({ data: parsed.data }), { status: 201 });
  }
  if (entity === "modules") {
    const parsed = moduleSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status)) return forbidden();
    const { markReviewed, ...data } = parsed.data;
    return NextResponse.json(await prisma.nseModule.create({ data: { ...data, lastReviewedAt: markReviewed ? new Date() : null } }), { status: 201 });
  }
  if (entity === "questions") {
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status)) return forbidden();
    const { options, ...data } = parsed.data;
    return NextResponse.json(await prisma.nseQuestion.create({ data: { ...data, options: { create: options } } }), { status: 201 });
  }
  if (entity === "labs") {
    const parsed = labSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status)) return forbidden();
    return NextResponse.json(await prisma.nseLab.create({ data: parsed.data }), { status: 201 });
  }
  if (entity === "import") {
    // All or nothing, and imported questions can't be published until someone has reviewed them.
    const parsed = z.array(z.unknown()).min(1).max(500).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Send a JSON array of up to 500 questions." }, { status: 400 });
    const questions = [];
    for (const [index, item] of parsed.data.entries()) {
      const question = questionSchema.safeParse({ ...(item as object), status: "DRAFT" });
      if (!question.success) return NextResponse.json({ error: `Question ${index + 1}: ${question.error.issues.map((issue) => issue.message).join(" ")}` }, { status: 400 });
      questions.push(question.data);
    }
    const moduleIds = [...new Set(questions.map((question) => question.moduleId))];
    if (await prisma.nseModule.count({ where: { id: { in: moduleIds } } }) !== moduleIds.length) return NextResponse.json({ error: "A moduleId in this file doesn't exist." }, { status: 400 });
    await prisma.$transaction(questions.map(({ options, ...data }) => prisma.nseQuestion.create({ data: { ...data, options: { create: options } } })));
    return NextResponse.json({ imported: questions.length }, { status: 201 });
  }
  return adminNotFound();
}
