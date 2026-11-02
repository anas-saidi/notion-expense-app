import { mirrorScope } from "./mirror/store";
import { randomUUID, createHash } from "node:crypto";
import type { BalanceCheck, BalanceCountReview } from "./balance-checks";
import type { ContributionAgreement, PartnerAmounts } from "./contribution-agreements";
import { currentLedgerRecord, NotionLedger, withNotionWrite } from "./notion-ledger";

async function assertRecordsRecovered(ledger: NotionLedger, scope: string) {
  const checkpoint = await ledger.current<any>(scope, "checkpoint", "postgres-cutover");
  if (checkpoint && checkpoint.payload.recordsReady !== true) throw Object.assign(new Error("Finance records are being recovered into Notion. Saved obligations remain unknown until recovery is confirmed."), { status: 503 });
}
export class NotionContributionStore {
  constructor(private ledger = new NotionLedger()) {}
  async list(scope: string): Promise<ContributionAgreement[]> {
    await assertRecordsRecovered(this.ledger, scope);
    const rows = await this.ledger.list<ContributionAgreement>(scope, "agreement");
    const keys = new Set(rows.map(row => row.key));
    return [...keys].map(key => currentLedgerRecord(rows.filter(row => row.key === key))!.payload).sort((a, b) => a.month.localeCompare(b.month));
  }
  async save(scope: string, month: string, targets: PartnerAmounts, shares: PartnerAmounts, expected: string | null, planAdditions?: ContributionAgreement["planAdditions"]) {
    await assertRecordsRecovered(this.ledger, scope);
    const current = await this.ledger.current<ContributionAgreement>(scope, "agreement", month);
    if ((current?.version ?? null) !== expected) return null;
    const now = new Date().toISOString();
    const agreement: ContributionAgreement = { month, planAdditions: planAdditions ?? current?.payload.planAdditions, original: current?.payload.original ?? targets, targets, shares, confirmedAt: current?.payload.confirmedAt ?? now, updatedAt: now, version: randomUUID() };
    return (await this.ledger.revise(scope, "agreement", month, expected, agreement, "active", agreement.version))?.payload ?? null;
  }
}
export class NotionBalanceCheckStore {
  constructor(private ledger = new NotionLedger()) {}
  async list(scope: string): Promise<BalanceCheck[]> {
    await assertRecordsRecovered(this.ledger, scope);
    const rows = await this.ledger.list<BalanceCheck>(scope, "balance-check");
    return [...new Set(rows.map(row => row.key))].flatMap(key => {
      const current = currentLedgerRecord(rows.filter(row => row.key === key))!;
      return current.state === "active" ? [current.payload] : [];
    });
  }
  async reviewCounts(scope: string): Promise<BalanceCountReview[]> {
    const rows = await this.ledger.list<BalanceCountReview>(scope, "balance-check");
    return [...new Set(rows.map(row => row.key))].flatMap(key => {
      const current = currentLedgerRecord(rows.filter(row => row.key === key))!;
      if (current.state !== "review") return [];
      if (!Number.isFinite(current.payload.actualBalance)) throw new Error("The saved balance count needs review in Notion.");
      return [{ accountId: key, actualBalance: current.payload.actualBalance, reportedDay: current.payload.reportedDay }];
    });
  }
  async recoveryPending(scope: string) { return (await this.reviewCounts(scope)).length > 0; }
  async save(scope: string, check: BalanceCheck, expected: string | null) {
    const current = await this.ledger.current<BalanceCheck>(scope, "balance-check", check.accountId);
    const active = current?.state === "active";
    if ((active ? current.version : null) !== expected) return false;
    return !!await this.ledger.revise(scope, "balance-check", check.accountId, current?.version ?? null, check, "active", check.version);
  }
  async close(scope: string, accountId: string, version: string) {
    const current = await this.ledger.current<BalanceCheck>(scope, "balance-check", accountId);
    if (current?.version !== version || current.state !== "active") return false;
    return !!await this.ledger.revise(scope, "balance-check", accountId, version, current.payload, "closed");
  }
}
export class NotionOperations {
  constructor(private ledger = new NotionLedger()) {}
  async once(scope: string, requestId: string, tool: string, input: unknown, run: () => Promise<Record<string, unknown>>, createdAt?: string) {
    return withNotionWrite("household-mutation", async () => {
      const fingerprint = createHash("sha256").update(JSON.stringify({ tool, input })).digest("hex");
      const old = await this.ledger.current<any>(scope, "operation", requestId);
      if (old) {
        if (old.payload.fingerprint !== fingerprint) throw new Error("requestId was already used with different inputs.");
        if (old.state !== "completed") throw new Error("This request is pending or its outcome is unknown. Check activity before trying again.");
        return old.payload.result;
      }
      const recovery = await this.ledger.current<any>(mirrorScope(process.env.NOTION_TOKEN ?? ""), "checkpoint", "postgres-cutover");
      const cutover = process.env.NOTION_OPERATIONS_CUTOVER || (recovery?.payload.operationHistoryRecovered ? undefined : recovery?.payload.cutover);
      if (cutover && !Number.isFinite(Date.parse(cutover))) throw new Error("The operation recovery cutoff is invalid. Nothing was written.");
      if (cutover && (!createdAt || !Number.isFinite(Date.parse(createdAt)) || Date.parse(createdAt) < Date.parse(cutover))) throw new Error("This request predates the Notion operation ledger or has no creation time. Its old receipt is unavailable. Review activity before retrying.");
      const pending = await this.ledger.append({ scope, kind: "operation", key: requestId, version: randomUUID(), replaces: null, state: "pending", payload: { fingerprint, tool, createdAt: createdAt ?? new Date().toISOString() } });
      // Never repeat an uncertain outcome, even when saving the receipt fails.
      const result = await run();
      await this.ledger.append({ scope, kind: "operation", key: requestId, version: randomUUID(), replaces: pending.version, state: "completed", payload: { ...pending.payload, result, finishedAt: new Date().toISOString() } });
      return result;
    });
  }
}
