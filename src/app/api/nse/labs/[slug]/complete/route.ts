import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentSession } from "@/lib/nse/session";
import { labDefinitionSchema, replayTranscript } from "@/lib/nse/lab-engine";
import { prisma } from "@/lib/prisma";

const schema = z.object({ transcript: z.array(z.string().max(300)).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { session, response } = await requireStudentSession();
  if (response) return response;
  const { slug } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lab session." }, { status: 400 });
  const lab = await prisma.nseLab.findFirst({ where: { slug, status: "PUBLISHED" }, select: { slug: true, definition: true } });
  if (!lab) return NextResponse.json({ error: "Lab not found." }, { status: 404 });

  const definition = labDefinitionSchema.parse(lab.definition);
  if (!replayTranscript(definition, parsed.data.transcript).complete) return NextResponse.json({ error: "Not every task is complete yet." }, { status: 422 });
  const labSlug = `nse:${lab.slug}`;
  await prisma.labCompletion.upsert({ where: { userId_labSlug: { userId: session.user.id, labSlug } }, create: { userId: session.user.id, labSlug }, update: {} });
  return NextResponse.json({ completed: true });
}
