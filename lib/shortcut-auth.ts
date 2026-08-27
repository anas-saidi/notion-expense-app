import { NextRequest, NextResponse } from "next/server";

function bearerToken(request: NextRequest): string | null {
  const value = request.headers.get("authorization");
  if (!value) return null;

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function tokensMatch(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export type BearerAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function requireBearerToken(
  request: NextRequest,
  envName: "SHORTCUT_API_TOKEN" | "CRON_SECRET",
  label: string,
): BearerAuthResult {
  const expected = process.env[envName];
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${label} is not configured. Set ${envName}.` },
        { status: 503 },
      ),
    };
  }

  if (envName === "SHORTCUT_API_TOKEN" && expected === process.env.NOTION_TOKEN) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "SHORTCUT_API_TOKEN must be a separate secret from NOTION_TOKEN." },
        { status: 503 },
      ),
    };
  }

  if (!tokensMatch(bearerToken(request), expected)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Invalid ${label} bearer token.` },
        {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer" },
        },
      ),
    };
  }

  return { ok: true };
}
