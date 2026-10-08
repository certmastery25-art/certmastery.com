import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Kept low so hashing fits the Cloudflare Workers Free CPU limit (~10 ms per request). Raise to 12 on a paid plan.
const PASSWORD_HASH_COST = 6;

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid name, email, and password (8-72 characters)." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password, PASSWORD_HASH_COST),
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}