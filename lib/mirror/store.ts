import { notionOnlyMode } from "../database-mode";
import { compileMirrorQuery } from "./sql-query";
import { Pool } from "pg";
import { databaseConnectionOptions } from "../database-tls";
import { createHash, randomUUID } from "node:crypto";

export const normalizeDatabaseId = (id: string) => id.replace(/-/g, "").toLowerCase();
export function mirrorDatabases() {
  return {
    accounts: process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b",
    categories: process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd",
    transactions: process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95",
    funds: process.env.NOTION_FUNDS_DB ?? "1936a2be-8922-8058-990d-c549172f1d45",
    pending: process.env.NOTION_PENDING_DB ?? "d2db101b-faec-467d-8c57-eee6d8780311",
  };
}
export function mirrorScope(token: string) {
  return createHash("sha256").update(token).update(JSON.stringify(Object.values(mirrorDatabases()).map(normalizeDatabaseId))).digest("hex");
}
export type MirroredDatabase = { schema: any; pages: any[]; queryResult?: any };
export type MirrorSnapshot = Record<string, MirroredDatabase>;
export const MIRROR_DDL = `
CREATE TABLE IF NOT EXISTS finance_mirror (
  scope text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0,
  published_revision bigint NOT NULL DEFAULT -1,
  snapshot jsonb, synced_at timestamptz, content_hash text, content_generation uuid,
  lease_id uuid, lease_until timestamptz, not_before timestamptz
);
CREATE TABLE IF NOT EXISTS finance_mirror_writes (
  id uuid PRIMARY KEY, scope text NOT NULL REFERENCES finance_mirror(scope), expires_at timestamptz NOT NULL
);
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS not_before timestamptz;
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS generation uuid;
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS content_generation uuid;
CREATE INDEX IF NOT EXISTS finance_mirror_writes_scope ON finance_mirror_writes(scope);
CREATE TABLE IF NOT EXISTS finance_mirror_schemas (
  scope text NOT NULL REFERENCES finance_mirror(scope), generation uuid NOT NULL,
  database_id text NOT NULL, schema jsonb NOT NULL,
  PRIMARY KEY (scope, generation, database_id)
);
CREATE TABLE IF NOT EXISTS finance_mirror_records (
  scope text NOT NULL REFERENCES finance_mirror(scope), generation uuid NOT NULL,
  database_id text NOT NULL, ordinal bigint NOT NULL, page jsonb NOT NULL,
  PRIMARY KEY (scope, generation, database_id, ordinal)
);
`;
export type SqlDriver = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  /** Pool transactions must pin one connection until commit/rollback. */
  connect?: () => Promise<{ query: SqlDriver["query"]; release: () => void }>;
};

/** Object key order is not a data change; page/array order remains meaningful. */
export function snapshotFingerprint(snapshot: MirrorSnapshot) {
  // Notion attaches a fresh HTTP request_id to each retrieved database
  // schema. It describes the request, not its financial/schema content.
  // Exclude only this exact transport field, never similarly named page
  // fields or user-defined properties.
  const content = Object.fromEntries(Object.entries(snapshot).map(([id, data]) => {
    if (!data.schema || typeof data.schema !== "object" || Array.isArray(data.schema)) return [id, data];
    const { request_id: _requestId, ...schema } = data.schema;
    return [id, { ...data, schema }];
  }));
  const canonical = JSON.stringify(content, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : value);
  return createHash("sha256").update(canonical).digest("hex");
}
const PUBLISH_BATCH_SIZE = 200;
const globalStore = globalThis as typeof globalThis & { financeMirrorPool?: Pool };
// Notion recomputes balance rollups/formulas several seconds after a write. Reads stay
// live during this window; importing sooner publishes pre-write balances as current.
export const WRITE_SETTLE_MS = 15_000;
export function mirrorConfigured() { return !notionOnlyMode() && !!process.env.DATABASE_URL; }
export function mirrorStore(): MirrorStore | null {
  if (!mirrorConfigured()) return null;
  if (!globalStore.financeMirrorPool) {
    const pool = new Pool({ ...databaseConnectionOptions(process.env.DATABASE_URL!), max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
    pool.on("error", () => console.error("Financial mirror database connection failed"));
    globalStore.financeMirrorPool = pool;
  }
  return new MirrorStore(globalStore.financeMirrorPool);
}
// Schema changes belong to tracked migrations, never request-time DDL. Even an
// IF NOT EXISTS ALTER takes a table lock and can serialize cold route instances.
const preparedScopes = new WeakMap<SqlDriver, Map<string, Promise<unknown>>>();
export class MirrorStore {
  constructor(private db: SqlDriver) {}
  async ready(scope: string) {
    let scopes = preparedScopes.get(this.db);
    if (!scopes) { scopes = new Map(); preparedScopes.set(this.db, scopes); }
    let prepared = scopes.get(scope);
    if (!prepared) {
      // Bound the process cache while avoiding a redundant network round trip per read.
      if (scopes.size >= 100) scopes.delete(scopes.keys().next().value!);
      prepared = this.db.query("INSERT INTO finance_mirror(scope) VALUES ($1) ON CONFLICT DO NOTHING", [scope]);
      scopes.set(scope, prepared);
      void prepared.catch(() => scopes!.delete(scope));
    }
    await prepared;
  }
  async read(scope: string, databaseId: string, maxAgeMs: number, body?: any, schemaOnly = false, allRows = false) {
    await this.ready(scope);
    const baseParams = [scope, normalizeDatabaseId(databaseId), maxAgeMs];
    const valid = `mirror.scope=$1 AND revision=published_revision AND synced_at > now() - ($3 * interval '1 millisecond')`;
    const source = `SELECT schemas.schema,mirror.generation,synced_at FROM finance_mirror mirror
      JOIN finance_mirror_schemas schemas ON schemas.scope=mirror.scope AND schemas.generation=mirror.generation AND schemas.database_id=$2
      WHERE ${valid}`;
    const records = `SELECT page,ordinal FROM finance_mirror_records WHERE scope=$1 AND database_id=$2 AND generation=source.generation`;
    let sql: string, params: any[];
    let pagination: { offset: number; size: number } | undefined;
    if (schemaOnly) {
      sql = `WITH source AS (${source}) SELECT schema,synced_at FROM source`;
      params = baseParams;
    } else if (body !== undefined) {
      const query = compileMirrorQuery(body);
      pagination = { offset: body.start_cursor ? Number(String(body.start_cursor).slice(7)) : 0, size: body.page_size ?? 100 };
      // Return individual pages instead of aggregating the entire ledger into a
      // nested JSONB value. Full-history reports spent seconds aggregating and
      // constructing that value before sending any data.
      // The source and its pages still share a single statement/MVCC snapshot.
      // One extra row determines pagination without counting/sorting twice.
      sql = `WITH source AS (${source}) SELECT entries.page,source.synced_at FROM source
        LEFT JOIN LATERAL (SELECT page,row_number() OVER (ORDER BY ${query.order}) AS position FROM (${records}) AS records
          WHERE ${query.where} AND NOT COALESCE((page->>'archived')::boolean,false) AND NOT COALESCE((page->>'in_trash')::boolean,false)
          ORDER BY ${query.order} OFFSET ${query.offset}${allRows ? "" : ` LIMIT ${query.size}+1`}) AS entries ON true`;
      // compileMirrorQuery reserves the page-size parameter even for full reads.
      // Keep it typed/referenced in that case without limiting the report.
      if (allRows) sql += ` WHERE ${query.size}::integer > 0`;
      sql += " ORDER BY entries.position";
      params = [...baseParams, ...query.params];
    } else {
      sql = `WITH source AS (${source}) SELECT entries.page,source.schema,source.synced_at FROM source
        LEFT JOIN LATERAL (${records}) AS entries ON true ORDER BY entries.ordinal`;
      params = baseParams;
    }
    const { rows } = await this.db.query(sql, params);
    if (!rows.length) return null;
    const pages = rows.flatMap(row => row.page == null ? [] : [row.page]);
    const more = !!pagination && !allRows && pages.length > pagination.size;
    const data: MirroredDatabase = pagination ? { pages: [], schema: undefined, queryResult: {
      results: more ? pages.slice(0, pagination.size) : pages,
      has_more: more,
      next_cursor: more ? `mirror:${pagination.offset + pagination.size}` : null,
    } } : { schema: rows[0].schema, pages };
    return { data, syncedAt: new Date(rows[0].synced_at).toISOString() };
  }
  async status(scope: string) {
    await this.ready(scope);
    const { rows } = await this.db.query("SELECT synced_at, revision=published_revision AND generation IS NOT NULL AS current, lease_until > now() AS syncing FROM finance_mirror WHERE scope=$1", [scope]);
    return rows[0];
  }
  async acquire(scope: string) {
    await this.ready(scope);
    const id = randomUUID();
    const { rows } = await this.db.query(`UPDATE finance_mirror SET lease_id=$2, lease_until=now()+interval '4 minutes'
      WHERE scope=$1 AND (lease_until IS NULL OR lease_until < now())
      AND (not_before IS NULL OR not_before <= now())
      AND NOT EXISTS (SELECT 1 FROM finance_mirror_writes WHERE scope=$1 AND expires_at > now())
      RETURNING revision`, [scope, id]);
    return rows.length ? { id, revision: rows[0].revision } : null;
  }
  async publish(scope: string, lease: { id: string; revision: string | number }, snapshot: MirrorSnapshot) {
    const fingerprint = snapshotFingerprint(snapshot);
    // pg Pool.query("BEGIN") followed by Pool.query(...) can use different
    // sessions. Keep every statement on the acquired client. Embedded/test
    // drivers already represent one connection and need no pool acquisition.
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query("BEGIN");
      try {
        const { rows } = await client.query(`WITH previous AS (
          SELECT scope,generation,COALESCE(content_hash=$4 AND content_generation=generation AND generation IS NOT NULL,false) AS unchanged
          FROM finance_mirror WHERE scope=$1 AND lease_id=$2 AND revision=$3 AND lease_until > now()
          AND NOT EXISTS (SELECT 1 FROM finance_mirror_writes WHERE scope=$1 AND expires_at > now()) FOR UPDATE
        ) UPDATE finance_mirror AS mirror
          SET snapshot=NULL, generation=CASE WHEN previous.unchanged THEN previous.generation ELSE $2::uuid END,
              content_generation=CASE WHEN previous.unchanged THEN previous.generation ELSE $2::uuid END,
              content_hash=$4,synced_at=now(),published_revision=mirror.revision,lease_id=NULL,lease_until=NULL
          FROM previous WHERE mirror.scope=previous.scope
          RETURNING mirror.synced_at,mirror.generation,previous.unchanged`, [scope, lease.id, lease.revision, fingerprint]);
        const published = rows[0];
        if (published && !published.unchanged) {
          for (const [databaseId, data] of Object.entries(snapshot)) {
            await client.query(`INSERT INTO finance_mirror_schemas(scope,generation,database_id,schema) VALUES($1,$2,$3,$4::jsonb)`,
              [scope, published.generation, databaseId, JSON.stringify(data.schema)]);
            for (let start = 0; start < data.pages.length; start += PUBLISH_BATCH_SIZE) {
              const params: any[] = [scope, published.generation, databaseId];
              const values = data.pages.slice(start, start + PUBLISH_BATCH_SIZE).map((page, offset) => {
                params.push(start + offset + 1, JSON.stringify(page));
                return `($1,$2,$3,$${params.length - 1}::bigint,$${params.length}::jsonb)`;
              });
              // VALUES streams bounded rows. jsonb_array_elements over the
              // complete ledger materialized tens of MB into temp files/run.
              await client.query(`INSERT INTO finance_mirror_records(scope,generation,database_id,ordinal,page) VALUES ${values.join(",")}`, params);
            }
          }
          await client.query("DELETE FROM finance_mirror_records WHERE scope=$1 AND generation<>$2", [scope, published.generation]);
          await client.query("DELETE FROM finance_mirror_schemas WHERE scope=$1 AND generation<>$2", [scope, published.generation]);
        }
        // Head, schemas, pages and cleanup become visible together. Unchanged
        // snapshots only renew freshness after checking the same write fences.
        await client.query("COMMIT");
        return published ? new Date(published.synced_at).toISOString() : null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      if ("release" in client && typeof client.release === "function") client.release();
    }
  }
  async release(scope: string, id: string) {
    await this.db.query("UPDATE finance_mirror SET lease_id=NULL, lease_until=NULL WHERE scope=$1 AND lease_id=$2", [scope, id]);
  }
  async beginWrite(scope: string) {
    await this.ready(scope);
    const id = randomUUID();
    await this.db.query(`WITH bumped AS (UPDATE finance_mirror SET revision=revision+1 WHERE scope=$1 RETURNING scope)
      INSERT INTO finance_mirror_writes(id,scope,expires_at) SELECT $2,scope,now()+interval '5 minutes' FROM bumped`, [scope, id]);
    return id;
  }
  async finishWrite(scope: string, id: string) {
    await this.db.query(`WITH removed AS (DELETE FROM finance_mirror_writes WHERE scope=$1 AND id=$2 RETURNING scope)
      UPDATE finance_mirror SET revision=revision+1, not_before=now()+($3 * interval '1 millisecond') WHERE scope IN (SELECT scope FROM removed)`, [scope, id, WRITE_SETTLE_MS]);
  }
}
