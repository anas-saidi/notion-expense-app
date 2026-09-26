import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE, verifySessionToken } from "./lib/auth";

export const config = {
  // App icons stay public: the home screen and browsers fetch them before anyone signs in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|icon-192.png|icon-512.png|icon-maskable-512.png|apple-touch-icon.png|manifest.json|sw.js).*)"],
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Local development does not need a registered Notion OAuth redirect URI.
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);

  if (isLocalDevelopment) {
    if (pathname === "/api/auth/session") return NextResponse.next();
    if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}
