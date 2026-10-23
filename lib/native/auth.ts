import { createHash, timingSafeEqual } from "node:crypto";

/** A dedicated, revocable device key. Never accept a browser session or a Notion token. */
export function authenticateNative(request: Request): Response | null {
  const expected = process.env.NATIVE_TOKEN_SHA256;
  const headers = { "Cache-Control": "no-store", "WWW-Authenticate": 'Bearer realm="finance-native"' };
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    return Response.json({ error: "Native access is not configured. Set NATIVE_TOKEN_SHA256 on the server." }, { status: 503, headers });
  }
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/i.exec(request.headers.get("authorization") ?? "");
  const digest = createHash("sha256").update(match?.[1] ?? "").digest();
  if (!match || !timingSafeEqual(digest, Buffer.from(expected, "hex"))) {
    return Response.json({ error: "Your device key is invalid. Reconnect in Settings." }, { status: 401, headers });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }
  return null;
}
