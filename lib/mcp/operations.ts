import { createHash } from "node:crypto";
import { Pool } from "pg";
import type { SqlDriver } from "../mirror/store";

export const MCP_OPERATIONS_DDL = `CREATE TABLE IF NOT EXISTS finance_mcp_operations (
  scope text NOT NULL, request_id text NOT NULL, fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'pending', result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  PRIMARY KEY (scope,request_id)
)`;
export type OperationResult = { [key: string]: unknown };

/** Claim before sending a non-idempotent Notion write. Unknown outcomes never auto-retry. */
export class McpOperations {
  private ready?: Promise<unknown>;
  constructor(private db: SqlDriver) {}
  async once(scope: string, requestId: string, tool: string, input: unknown, run: () => Promise<OperationResult>): Promise<OperationResult> {
    this.ready ??= this.db.query(MCP_OPERATIONS_DDL).catch(error => { this.ready = undefined; throw error; });
    await this.ready;
    const fingerprint = createHash("sha256").update(JSON.stringify({ tool, input })).digest("hex");
    const claim = await this.db.query(`INSERT INTO finance_mcp_operations(scope,request_id,fingerprint)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING request_id`, [scope, requestId, fingerprint]);
    if (!claim.rows.length) {
      const { rows } = await this.db.query("SELECT fingerprint,state,result FROM finance_mcp_operations WHERE scope=$1 AND request_id=$2", [scope, requestId]);
      const old = rows[0];
      if (!old || old.fingerprint !== fingerprint) throw new Error("requestId was already used with different inputs. Do not resubmit this operation.");
      if (old.state !== "completed") throw new Error("This request is pending or its outcome is unknown. Check activity before making another write; do not retry with a new requestId.");
      return old.result;
    }
    try {
      const result = await run();
      await this.db.query("UPDATE finance_mcp_operations SET state='completed',result=$3::jsonb,finished_at=now() WHERE scope=$1 AND request_id=$2", [scope, requestId, JSON.stringify(result)]);
      return result;
    } catch (error) {
      // Keep the claim even after a timeout or failed receipt save. Notion may have committed.
      throw new Error(`${error instanceof Error ? error.message : "Operation failed"} Check activity before trying again; this request will not be executed twice.`);
    }
  }
}
const shared = globalThis as typeof globalThis & { financeMcpOperations?: McpOperations };
export function mcpOperations() {
  if (!process.env.DATABASE_URL) throw new Error("Financial operation tracking is unavailable; nothing was written.");
  return shared.financeMcpOperations ??= new McpOperations(new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 10000 }));
}
