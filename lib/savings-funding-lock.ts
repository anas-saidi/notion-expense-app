import { Pool } from "pg";
import { createHash } from "node:crypto";
const state = globalThis as typeof globalThis & { savingsFundingPool?: Pool };

/** Serialize the same operation across Vercel instances, not just one process. */
export async function withSavingsFundingLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Savings funding needs the server database connection. Nothing was changed."), { status: 503 });
    return action();
  }
  const pool = state.savingsFundingPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  const lockId = createHash("sha256").update(key).digest("hex");
  let locked = false;
  let destroyed = false;
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked", [lockId]);
    locked = Boolean(result.rows[0]?.locked);
    if (!locked) throw Object.assign(new Error("This savings deposit is already being saved. Wait a moment and retry."), { status: 409, pending: true });
    return await action();
  } finally {
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [lockId]); }
      catch { client.release(true); destroyed = true; }
    }
    if (!destroyed) client.release();
  }
}
