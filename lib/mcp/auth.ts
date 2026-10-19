import { createHash, timingSafeEqual } from "node:crypto";

export function authenticateMcp(request: Request): Response | null {
  const expected = process.env.MCP_TOKEN_SHA256;
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    return Response.json({ error: "Finance MCP is not configured" }, { status: 503 });
  }
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/i.exec(value);
  const digest = createHash("sha256").update(match?.[1] ?? "").digest();
  if (!match || !timingSafeEqual(digest, Buffer.from(expected, "hex"))) {
    return Response.json({ error: "Invalid Finance MCP access key" }, {
      status: 401, headers: { "WWW-Authenticate": 'Bearer realm="finance-mcp"', "Cache-Control": "no-store" },
    });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  return null;
}
