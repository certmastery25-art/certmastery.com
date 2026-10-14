import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// The session role is re-read from the database on every request (see the jwt callback in auth.ts),
// so granting or revoking ADMIN takes effect immediately.
export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "ADMIN" ? session : null;
}

// Admin pages answer 404 to everyone else so the area is not advertised.
export async function requireAdminPage() {
  const session = await getAdminSession();
  if (!session) notFound();
  return session;
}

export function adminNotFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}
