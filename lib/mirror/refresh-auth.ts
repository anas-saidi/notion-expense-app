import { createHmac, timingSafeEqual } from "node:crypto";

/** pg_net's queue is readable by database login roles. Put only an expiring,
 * task-specific signature there, never the reusable scheduler credential. */
export function signedMirrorRefresh(request: Request, now = Date.now()): boolean {
  const secret = process.env.FINANCE_MIRROR_REFRESH_SECRET;
  const timestamp = request.headers.get("x-finance-refresh-time") ?? "";
  const signature = request.headers.get("x-finance-refresh-signature") ?? "";
  if (!secret || request.method !== "GET" || new URL(request.url).pathname !== "/api/sync/refresh" || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const age = now - Number(timestamp) * 1000;
  if (age < -30_000 || age > 300_000) return false;
  const expected = createHmac("sha256", secret).update(`finance-mirror-refresh:GET:/api/sync/refresh:${timestamp}`).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}
