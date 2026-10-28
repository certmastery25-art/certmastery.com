import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createLabState, findCcnaLab, isLabComplete, runLabCommand } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

const completionSchema = z.object({
  commands: z.array(z.string().trim().min(1).max(240)).min(1).max(1500),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = findCcnaLab(slug);
  if (!lab) return NextResponse.json({ error: "Lab not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = completionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lab completion." }, { status: 400 });

  // Replay the session on the server so completion can't be claimed without doing the work.
  const finalState = parsed.data.commands.reduce(
    (state, command) => runLabCommand(lab, state, command, { fast: true }).state,
    createLabState(lab),
  );
  if (!isLabComplete(lab, finalState)) return NextResponse.json({ error: "Complete each lab requirement before saving progress." }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user.id) return NextResponse.json({ completed: true, saved: false });

  await prisma.labCompletion.upsert({
    where: { userId_labSlug: { userId: session.user.id, labSlug: slug } },
    create: { userId: session.user.id, labSlug: slug },
    update: { completedAt: new Date() },
  });
  return NextResponse.json({ completed: true, saved: true });
}
