import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ccnaLabs, initialCcnaLabState, isCcnaLabComplete, runCcnaLabCommand } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

const completionSchema = z.object({
  commands: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!ccnaLabs.some((lab) => lab.slug === slug)) return NextResponse.json({ error: "Lab not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = completionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lab completion." }, { status: 400 });

  const finalState = parsed.data.commands.reduce(
    (state, command) => runCcnaLabCommand(state, command).state,
    initialCcnaLabState,
  );
  if (!isCcnaLabComplete(finalState)) return NextResponse.json({ error: "Complete each lab requirement before saving progress." }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user.id) return NextResponse.json({ completed: true, saved: false });

  await prisma.labCompletion.upsert({
    where: { userId_labSlug: { userId: session.user.id, labSlug: slug } },
    create: { userId: session.user.id, labSlug: slug },
    update: { completedAt: new Date() },
  });
  return NextResponse.json({ completed: true, saved: true });
}
