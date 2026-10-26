import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

function isQuestionAccessPath(pathname: string) {
  return pathname.startsWith("/practice/")
    || pathname.startsWith("/quiz/")
    || pathname === "/api/questions"
    || pathname.startsWith("/api/quizzes")
    || pathname === "/api/attempts";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isQuestionAccessPath(pathname)) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Create an account or sign in to access practice questions.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/register?reason=account-required", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
