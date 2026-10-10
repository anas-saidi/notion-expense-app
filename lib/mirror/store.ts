import { compileMirrorQuery } from "./sql-query";
import { Pool } from "pg";
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
  snapshot jsonb, synced_at timestamptz,
  lease_id uuid, lease_until timestamptz, not_before timestamptz
);
CREATE TABLE IF NOT EXISTS finance_mirror_writes (
  id uuid PRIMARY KEY, scope text NOT NULL REFERENCES finance_mirror(scope), expires_at timestamptz NOT NULL
);
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS not_before timestamptz;
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS generation uuid;
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
export type SqlDriver = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
const globalStore = globalThis as typeof globalThis & { financeMirrorPool?: Pool };
// Notion recomputes balance rollups/formulas several seconds after a write. Reads stay
// live during this window; importing sooner publishes pre-write balances as current.
export const WRITE_SETTLE_MS = 15_000;
export function mirrorConfigured() { return !!process.env.DATABASE_URL; }
export function mirrorStore(): MirrorStore | null {
  if (!mirrorConfigured()) return null;
  if (!globalStore.financeMirrorPool) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 60000, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
    pool.on("error", () => console.error("Financial mirror database connection failed"));
    globalStore.financeMirrorPool = pool;
  }
  return new MirrorStore(globalStore.financeMirrorPool);
}
// DDL is initialized once per driver. Failure is evicted so a repaired DB can recover.
const initialized = new WeakMap<SqlDriver, Promise<unknown>>();
const preparedScopes = new WeakMap<SqlDriver, Map<string, Promise<unknown>>>();
export class MirrorStore {
  constructor(private db: SqlDriver) {}
  async ready(scope: string) {
    let init = initialized.get(this.db);
    if (!init) {
      init = this.db.query(MIRROR_DDL);
      initialized.set(this.db, init);
      void init.catch(() => initialized.delete(this.db));
    }
    await init;
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
    if (schemaOnly) {
      sql = `WITH source AS (${source}) SELECT jsonb_build_object('schema',schema,'pages','[]'::jsonb) AS data,synced_at FROM source`;
      params = baseParams;
    } else if (body !== undefined) {
      const query = compileMirrorQuery(body);
      sql = `WITH source AS (${source}),
        filtered AS (SELECT page,row_number() OVER (ORDER BY ${query.order}) AS n FROM source,
          LATERAL (${records}) AS entries
          WHERE ${query.where} AND NOT COALESCE((page->>'archived')::boolean,false) AND NOT COALESCE((page->>'in_trash')::boolean,false))
        SELECT jsonb_build_object('queryResult',jsonb_build_object(
          'results',COALESCE((SELECT jsonb_agg(page ORDER BY n) FROM filtered WHERE n>${query.offset} AND (${allRows ? "true" : "false"} OR n<=${query.offset}+${query.size})),'[]'::jsonb),
          'has_more',${allRows ? 'false AND' : ''} (SELECT count(*) FROM filtered)>${query.offset}+${query.size},
          'next_cursor',CASE WHEN ${allRows ? 'false AND' : ''} (SELECT count(*) FROM filtered)>${query.offset}+${query.size} THEN 'mirror:'||(${query.offset}+${query.size})::text ELSE NULL END)) AS data,synced_at FROM source`;
      params = [...baseParams, ...query.params];
    } else {
      sql = `WITH source AS (${source}) SELECT jsonb_build_object('schema',schema,'pages',
        COALESCE((SELECT jsonb_agg(page ORDER BY ordinal) FROM (${records}) AS entries),'[]'::jsonb)) AS data,synced_at FROM source`;
      params = baseParams;
    }
    const { rows } = await this.db.query(sql, params);
    return rows[0]?.data ? { data: rows[0].data as MirroredDatabase, syncedAt: new Date(rows[0].synced_at).toISOString() } : null;
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
    const { rows } = await this.db.query(`WITH published AS (UPDATE finance_mirror
      SET snapshot=NULL, generation=$2, synced_at=now(), published_revision=revision, lease_id=NULL, lease_until=NULL
      WHERE scope=$1 AND lease_id=$2 AND revision=$3 AND lease_until > now()
      AND NOT EXISTS (SELECT 1 FROM finance_mirror_writes WHERE scope=$1 AND expires_at > now()) RETURNING synced_at),
      schemas AS (INSERT INTO finance_mirror_schemas(scope,generation,database_id,schema)
        SELECT $1,$2,db.key,db.value->'schema' FROM published,jsonb_each($4::jsonb) AS db),
      records AS (INSERT INTO finance_mirror_records(scope,generation,database_id,ordinal,page)
        SELECT $1,$2,db.key,entries.ordinal,entries.page FROM published,jsonb_each($4::jsonb) AS db,
        LATERAL jsonb_array_elements(db.value->'pages') WITH ORDINALITY AS entries(page,ordinal)),
      old_schemas AS (DELETE FROM finance_mirror_schemas WHERE scope=$1 AND generation<>$2 AND EXISTS (SELECT 1 FROM published)),
      old_records AS (DELETE FROM finance_mirror_records WHERE scope=$1 AND generation<>$2 AND EXISTS (SELECT 1 FROM published))
      SELECT synced_at FROM published`,
    [scope, lease.id, lease.revision, JSON.stringify(snapshot)]);
    return rows[0] ? new Date(rows[0].synced_at).toISOString() : null;
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
