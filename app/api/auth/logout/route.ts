import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  // Financial answers are kept on the device for a fast first screen; signing out removes them.
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
