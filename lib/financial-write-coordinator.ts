import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseConnectionOptions } from "./database-tls";
import { notionOnlyMode } from "./database-mode";

/** Requires a session connection: the same PostgreSQL session owns the lock
 * throughout the Notion operation. Never use a transaction-pooling URL here. */
export const FINANCIAL_COORDINATION_DDL = `
CREATE TABLE IF NOT EXISTS finance_write_guards (
  scope text PRIMARY KEY,
  owner uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_notion_write_receipts (
  database_id text NOT NULL, page_id text NOT NULL, scope text NOT NULL,
  kind text NOT NULL, record_key text NOT NULL, version text NOT NULL,
  PRIMARY KEY(database_id,page_id)
);`;

type Result = { rows: any[]; rowCount?: number | null };
export interface CoordinationClient {
  query(sql: string, params?: any[]): Promise<Result>;
  on(event: "error", listener: (error: Error) => void): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
  release(destroy?: boolean): void;
}
export interface CoordinationPool {
  query(sql: string, params?: any[]): Promise<Result>;
  connect(): Promise<CoordinationClient>;
}
type HeldWrite = { scope: string; client: CoordinationClient; lost: boolean };
const heldWrites = new AsyncLocalStorage<HeldWrite>();
const shared = globalThis as typeof globalThis & { financeWriteCoordinator?: FinancialWriteCoordinator; financeCoordinationPool?: Pool };
export const databaseCoordinationConfigured = () => !notionOnlyMode() && !!process.env.FINANCE_COORDINATION_DATABASE_URL;
export function coordinationPool() {
  if (!databaseCoordinationConfigured()) throw unavailable("Shared financial coordination is not configured. Nothing was changed.");
  if (!shared.financeCoordinationPool) {
    const pool = new Pool({ ...databaseConnectionOptions(process.env.FINANCE_COORDINATION_DATABASE_URL!), max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, query_timeout: 5000, statement_timeout: 5000 });
    pool.on("error", () => console.error("Financial coordination database connection failed"));
    shared.financeCoordinationPool = pool;
  }
  return shared.financeCoordinationPool;
}
export function withDatabaseFinancialWrite<T>(action: () => Promise<T>) {
  const database = process.env.NOTION_FINANCE_RECORDS_DB?.replace(/-/g, "").toLowerCase();
  if (!database) throw unavailable("Notion Finance Records must be configured before enabling coordinated saves.");
  const coordinator = shared.financeWriteCoordinator ??= new FinancialWriteCoordinator(coordinationPool());
  if (heldWrites.getStore()) return coordinator.run(`notion-finance:${database}`, action);
  return coordinator.run(`notion-finance:${database}`, async () => {
    const { mirrorStore, mirrorScope } = await import("./mirror/store");
    const token = process.env.NOTION_TOKEN;
    const store = mirrorStore();
    if (!store || !token) return action();
    const scope = mirrorScope(token);
    const fence = await store.beginWrite(scope);
    try { return await action(); }
    finally {
      await store.finishWrite(scope, fence);
      const { scheduleMirrorSync } = await import("./mirror/sync");
      scheduleMirrorSync(token, true);
    }
  });
}
export async function recordNotionWriteReceipt(database: string, record: { id: string; scope: string; kind: string; key: string; version: string }) {
  const held = heldWrites.getStore();
  if (!held) throw unavailable("A Notion financial write requires shared coordination.");
  try {
    await held.client.query("INSERT INTO finance_notion_write_receipts(database_id,page_id,scope,kind,record_key,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [database, record.id, record.scope, record.kind, record.key, record.version]);
  } catch {
    held.lost = true;
    throw unavailable("The financial record may have saved but its receipt was not confirmed. Review activity before retrying.");
  }
}
/** Receipts contain identity only. Missing query results must be checked against
 * Notion by page ID, never reconstructed from a SQL financial payload. */
export async function notionWriteReceipts(database: string, scope: string, kind: string, key?: string): Promise<string[]> {
  if (!databaseCoordinationConfigured()) return [];
  const held = heldWrites.getStore();
  try {
    const db = held?.client ?? coordinationPool();
    const { rows } = await db.query("SELECT page_id FROM finance_notion_write_receipts WHERE database_id=$1 AND scope=$2 AND kind=$3 AND ($4::text IS NULL OR record_key=$4)", [database, scope, kind, key ?? null]);
    return rows.map(row => row.page_id);
  } catch {
    if (!held) return []; // Display reads can fall back to a successful live query.
    held.lost = true;
    throw unavailable("Could not verify financial write receipts. Nothing further was changed.");
  }
}
const unavailable = (message: string) => Object.assign(new Error(message), { status: 503, code: "FINANCIAL_COORDINATION_UNAVAILABLE", retryable: false });

/** Check immediately before each Notion side effect as well as on lock entry.
 * A request already in flight when connectivity fails may still commit; its
 * durable guard remains for review instead of allowing an automatic replay. */
export async function assertFinancialWriteConnection() {
  const held = heldWrites.getStore();
  if (!held) return;
  if (held.lost) throw unavailable("The financial save connection was lost. Review activity before retrying.");
  try { await held.client.query("SELECT 1"); }
  catch {
    held.lost = true;
    throw unavailable("The financial save connection was lost. Review activity before retrying.");
  }
  if (held.lost) throw unavailable("The financial save connection was lost. Review activity before retrying.");
}

export class FinancialWriteCoordinator {
  private ready?: Promise<unknown>;
  constructor(private pool: CoordinationPool) {}

  async run<T>(scope: string, action: () => Promise<T>): Promise<T> {
    const parent = heldWrites.getStore();
    if (parent) {
      if (parent.scope !== scope) throw unavailable("A financial save cannot nest another household's operation.");
      await assertFinancialWriteConnection();
      return action();
    }
    this.ready ??= this.pool.query(FINANCIAL_COORDINATION_DDL).catch(error => { this.ready = undefined; throw error; });
    await this.ready;
    const client = await this.pool.connect();
    const held: HeldWrite = { scope, client, lost: false };
    const owner = randomUUID();
    let locked = false;
    let claimed = false;
    let cleaned = false;
    const lost = () => { held.lost = true; };
    client.on("error", lost);
    try {
      const result = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked", [`finance-write:${scope}`]);
      locked = result.rows[0]?.locked === true;
      if (!locked) throw Object.assign(new Error("Another financial save is in progress. Wait a moment and retry."), { status: 409, pending: true });
      // An abandoned row is intentionally NOT expired. Losing a worker doesn't
      // establish whether its Notion request committed. Reconciliation clears it.
      const claim = await client.query("INSERT INTO finance_write_guards(scope,owner) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING owner", [scope, owner]);
      claimed = claim.rows.length === 1;
      if (!claimed) throw unavailable("An interrupted financial save needs review. No new changes were made.");
      return await heldWrites.run(held, async () => {
        await assertFinancialWriteConnection();
        const result = await action();
        await assertFinancialWriteConnection();
        return result;
      });
    } finally {
      try {
        if (claimed && !held.lost) {
          await client.query("DELETE FROM finance_write_guards WHERE scope=$1 AND owner=$2", [scope, owner]);
          cleaned = true;
        }
        if (locked && !held.lost) await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [`finance-write:${scope}`]);
      } catch {
        held.lost = true;
        // Returning success when guard cleanup failed would hide an uncertain
        // outcome. Destroy the session; a retained guard blocks future writes.
        throw unavailable("Could not confirm financial save completion. Review activity before retrying.");
      } finally {
        client.removeListener("error", lost);
        client.release(held.lost);
      }
      if (claimed && !cleaned) throw unavailable("The financial save connection was lost. Review activity before retrying.");
    }
  }
}
