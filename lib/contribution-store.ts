import { NotionContributionStore } from "./notion-finance-stores";
import { notionLedgerConfigured } from "./notion-ledger";
import { assertSharedDatabaseEnabled } from "./database-mode";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { SqlDriver } from "./mirror/store";
import type { ContributionAgreement, PartnerAmounts } from "./contribution-agreements";

export const CONTRIBUTION_DDL = `CREATE TABLE IF NOT EXISTS finance_contribution_agreements (
  scope text NOT NULL, month text NOT NULL, version uuid NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(scope, month)
); CREATE TABLE IF NOT EXISTS finance_contribution_agreement_history (
  scope text NOT NULL, month text NOT NULL, version uuid NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(scope,month,version)
);`;
const initialized = new WeakMap<SqlDriver, Promise<unknown>>();
export class ContributionStore {
  constructor(private db: SqlDriver) {}
  private async ready() {
    let init = initialized.get(this.db);
    if (!init) { init = this.db.query(CONTRIBUTION_DDL); initialized.set(this.db, init); void init.catch(() => initialized.delete(this.db)); }
    await init;
  }
  async list(scope: string): Promise<ContributionAgreement[]> {
    await this.ready();
    return (await this.db.query(`SELECT payload FROM finance_contribution_agreements WHERE scope=$1 ORDER BY month`, [scope])).rows.map(r => r.payload);
  }
  async save(scope: string, month: string, targets: PartnerAmounts, shares: PartnerAmounts, expected: string | null, planAdditions?: ContributionAgreement["planAdditions"]) {
    await this.ready();
    const current = (await this.list(scope)).find(a => a.month === month);
    if ((current?.version ?? null) !== expected) return null;
    const now = new Date().toISOString();
    const agreement: ContributionAgreement = { month, planAdditions: planAdditions ?? current?.planAdditions, original: current?.original ?? targets, targets, shares, confirmedAt: current?.confirmedAt ?? now, updatedAt: now, version: randomUUID() };
    // The unique month key and conditional upsert make confirmation atomic.
    // Append every accepted revision in the same SQL statement.
    const result = await this.db.query(`WITH changed AS (
      INSERT INTO finance_contribution_agreements(scope,month,version,payload)
      SELECT $1,$2,$3,$4::jsonb WHERE $5::text IS NULL OR EXISTS (SELECT 1 FROM finance_contribution_agreements WHERE scope=$1 AND month=$2)
      ON CONFLICT(scope,month) DO UPDATE SET version=EXCLUDED.version,payload=EXCLUDED.payload
      WHERE finance_contribution_agreements.version::text=$5::text
      RETURNING scope,month,version,payload)
      INSERT INTO finance_contribution_agreement_history SELECT * FROM changed RETURNING payload`, [scope, month, agreement.version, JSON.stringify(agreement), expected]);
    return result.rows[0]?.payload as ContributionAgreement | undefined ?? null;
  }
}
const state = globalThis as typeof globalThis & { financeContributionPool?: Pool };
export function contributionPool() {
  assertSharedDatabaseEnabled();
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("Contribution agreements need the shared database connection."), { status: 503 });
  return state.financeContributionPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000 });
}
export const contributionStore = () => notionLedgerConfigured() ? new NotionContributionStore() : new ContributionStore(contributionPool());
