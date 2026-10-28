import { Pool } from "pg";
import type { BalanceCheck } from "./balance-checks";
import type { SqlDriver } from "./mirror/store";

export const BALANCE_CHECK_DDL = `CREATE TABLE IF NOT EXISTS finance_balance_checks (
  scope text NOT NULL, account_id text NOT NULL, payload jsonb NOT NULL,
  closed boolean NOT NULL DEFAULT false, PRIMARY KEY (scope, account_id)
)`;
const initialized = new WeakMap<SqlDriver, Promise<unknown>>();
export class BalanceCheckStore {
  constructor(private db: SqlDriver) {}
  private async ready() {
    let init = initialized.get(this.db);
    if (!init) { init = this.db.query(BALANCE_CHECK_DDL); initialized.set(this.db, init); void init.catch(() => initialized.delete(this.db)); }
    await init;
  }
  async list(scope: string): Promise<BalanceCheck[]> {
    await this.ready();
    return (await this.db.query("SELECT payload FROM finance_balance_checks WHERE scope=$1 AND NOT closed", [scope])).rows.map(row => row.payload);
  }
  async save(scope: string, check: BalanceCheck, expectedVersion: string | null) {
    await this.ready();
    const result = await this.db.query(`INSERT INTO finance_balance_checks(scope,account_id,payload) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT(scope,account_id) DO UPDATE SET payload=EXCLUDED.payload,closed=false
      WHERE (finance_balance_checks.closed AND $4::text IS NULL)
        OR (NOT finance_balance_checks.closed AND finance_balance_checks.payload->>'version'=$4::text)
      RETURNING account_id`, [scope, check.accountId, JSON.stringify(check), expectedVersion]);
    return result.rows.length > 0;
  }
  async close(scope: string, accountId: string, version: string) {
    await this.ready();
    return (await this.db.query(`UPDATE finance_balance_checks SET closed=true WHERE scope=$1 AND account_id=$2 AND NOT closed
      AND payload->>'version'=$3 RETURNING account_id`, [scope, accountId, version])).rows.length > 0;
  }
}
const globalChecks = globalThis as typeof globalThis & { financeBalanceCheckPool?: Pool };
export function balanceCheckStore() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("Balance checks need the shared database connection."), { status: 503 });
  const pool = globalChecks.financeBalanceCheckPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  return new BalanceCheckStore(pool);
}
