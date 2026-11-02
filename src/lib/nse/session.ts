import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireStudentSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return { session: null, response: NextResponse.json({ error: "Create an account or sign in to access practice questions and labs.", code: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  return { session, response: null };
}
