import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentSession } from "@/lib/nse/session";
import { prisma } from "@/lib/prisma";

const schema = z.object({ completed: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireStudentSession();
  if (response) return response;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const found = await prisma.nseModule.findFirst({ where: { id, status: "PUBLISHED", pathway: { status: "PUBLISHED" } }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Module not found." }, { status: 404 });
  const key = { userId: session.user.id, moduleId: found.id };
  if (parsed.data.completed) await prisma.nseModuleProgress.upsert({ where: { userId_moduleId: key }, create: key, update: {} });
  else await prisma.nseModuleProgress.deleteMany({ where: key });
  return NextResponse.json({ completed: parsed.data.completed });
}
