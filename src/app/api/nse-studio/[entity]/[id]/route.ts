import { NextResponse } from "next/server";
import type { z } from "zod";
import { adminNotFound } from "@/lib/admin/guard";
import { getEditorSession, labSchema, mayPublish, moduleSchema, pathwaySchema, questionSchema } from "@/lib/nse/studio";
import { prisma } from "@/lib/prisma";

const invalid = (error: z.ZodError) => NextResponse.json({ error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
const forbidden = () => NextResponse.json({ error: "Only an administrator can publish content." }, { status: 403 });
const missing = () => NextResponse.json({ error: "Not found." }, { status: 404 });

export async function PUT(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const session = await getEditorSession();
  if (!session) return adminNotFound();
  const { entity, id } = await params;
  const body = await request.json().catch(() => null);
  const role = session.user.role;

  if (entity === "pathways") {
    const current = await prisma.nsePathway.findUnique({ where: { id }, select: { status: true } });
    if (!current) return missing();
    const parsed = pathwaySchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status, current.status)) return forbidden();
    return NextResponse.json(await prisma.nsePathway.update({ where: { id }, data: parsed.data }));
  }
  if (entity === "modules") {
    const current = await prisma.nseModule.findUnique({ where: { id }, select: { status: true } });
    if (!current) return missing();
    const parsed = moduleSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status, current.status)) return forbidden();
    const { markReviewed, ...data } = parsed.data;
    return NextResponse.json(await prisma.nseModule.update({ where: { id }, data: { ...data, ...(markReviewed ? { lastReviewedAt: new Date() } : {}) } }));
  }
  if (entity === "questions") {
    const current = await prisma.nseQuestion.findUnique({ where: { id }, select: { status: true } });
    if (!current) return missing();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status, current.status)) return forbidden();
    const { options, ...data } = parsed.data;
    const labels = options.map((option) => option.label);
    await prisma.$transaction([
      prisma.nseOption.deleteMany({ where: { questionId: id, label: { notIn: labels } } }),
      ...options.map((option) => prisma.nseOption.upsert({ where: { questionId_label: { questionId: id, label: option.label } }, create: { ...option, questionId: id }, update: option })),
      prisma.nseQuestion.update({ where: { id }, data }),
    ]);
    return NextResponse.json({ saved: true });
  }
  if (entity === "labs") {
    const current = await prisma.nseLab.findUnique({ where: { id }, select: { status: true } });
    if (!current) return missing();
    const parsed = labSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error);
    if (!mayPublish(role, parsed.data.status, current.status)) return forbidden();
    return NextResponse.json(await prisma.nseLab.update({ where: { id }, data: parsed.data }));
  }
  return adminNotFound();
}
