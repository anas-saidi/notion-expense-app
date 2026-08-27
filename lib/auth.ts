import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const STATE_COOKIE = "notion_oauth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 365 days

export const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/logout",
  // Shortcut routes authenticate with their own bearer tokens.
  "/api/shortcuts",
];

export type SessionPayload = {
  email: string | null;
  name: string | null;
  notionUserId: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return {
      email: (payload.email as string | null) ?? null,
      name: (payload.name as string | null) ?? null,
      notionUserId: payload.notionUserId as string,
    };
  } catch {
    return null;
  }
}

export function isAllowedNotionIdentity({
  email,
  id,
}: {
  email: string | null;
  id: string;
}): boolean {
  const allowedEmails = (process.env.ALLOWED_NOTION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email) {
    return allowedEmails.includes(email.trim().toLowerCase());
  }

  const allowedIds = (process.env.ALLOWED_NOTION_USER_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return allowedIds.includes(id);
}
