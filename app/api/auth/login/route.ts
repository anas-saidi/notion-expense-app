import { NextResponse } from "next/server";
import { STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export function GET() {
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId || !appUrl) {
    return NextResponse.json({ error: "OAuth is not configured" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${appUrl}/api/auth/callback`;

  const authorizeUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("owner", "user");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 60 * 10,
  });
  return response;
}
