import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_QUESTION_COOKIE, GUEST_QUESTION_LIMIT, readGuestQuestionCount } from "@/lib/guest-access";

const publicPaths = new Set(["/login", "/register", "/privacy"]);

export async function middleware(request: NextRequest) {
  const guestQuestionCount = await readGuestQuestionCount(request.cookies.get(GUEST_QUESTION_COOKIE)?.value);
  if (guestQuestionCount < GUEST_QUESTION_LIMIT) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Create a free account to continue after your 10 guest questions.", code: "GUEST_LIMIT_REACHED" },
      { status: 403 },
    );
  }

  return NextResponse.redirect(new URL("/register?reason=question-limit", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
