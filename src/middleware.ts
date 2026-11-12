import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Practice questions and individual labs need an account; the /certifications and /labs listings stay public.
function isAccountOnlyPath(pathname: string) {
  return pathname.startsWith("/practice/")
    || pathname.startsWith("/labs/")
    || pathname.startsWith("/api/labs/")
    || pathname.startsWith("/quiz/")
    || pathname.startsWith("/fortinet/exam/")
    || pathname.startsWith("/fortinet/labs/")
    || pathname === "/fortinet/dashboard"
    || pathname.startsWith("/azure/exam/")
    || pathname === "/azure/dashboard"
    || pathname.startsWith("/api/nse/")
    || pathname === "/api/questions"
    || pathname.startsWith("/api/quizzes")
    || pathname === "/api/attempts";
}

// Browsers always send Origin on cross-site POSTs, so NSE writes from other sites can be refused outright.
function isCrossSiteNseWrite(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) || !pathname.startsWith("/api/nse/")) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isCrossSiteNseWrite(request)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  if (!isAccountOnlyPath(pathname)) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Create an account or sign in to access practice questions and labs.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/register?reason=account-required", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
