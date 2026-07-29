import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
  createSessionToken,
  isAllowedNotionIdentity,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const appUrl = process.env.APP_URL;
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;

  const failure = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  if (!appUrl || !clientId || !clientSecret) {
    return failure("not_allowed");
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return failure("not_allowed");
  }

  const redirectUri = `${appUrl}/api/auth/callback`;

  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return failure("not_allowed");
  }

  const tokenData = await tokenResponse.json();
  const owner = tokenData?.owner?.user;

  if (!owner?.id) {
    return failure("not_allowed");
  }

  const email: string | null = owner.person?.email ?? null;
  const name: string | null = owner.name ?? null;

  if (!isAllowedNotionIdentity({ email, id: owner.id })) {
    return failure("not_allowed");
  }

  const sessionToken = await createSessionToken({
    email,
    name,
    notionUserId: owner.id,
  });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(STATE_COOKIE);
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
