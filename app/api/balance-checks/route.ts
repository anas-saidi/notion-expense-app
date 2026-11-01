import { databaseUnavailableFailure } from "../../../lib/database-errors";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readAccountResponse } from "../../../lib/notion-accounts";
import type { Account, Transaction } from "../../components/app-types";
import { accountKey, cashMovement, casablancaDay, checkView, money, type BalanceCheck } from "../../../lib/balance-checks";
import { balanceCheckStore } from "../../../lib/balance-check-store";
import { mirrorScope } from "../../../lib/mirror/store";
import { withMirrorReads } from "../../../lib/mirror/routes";
import { queryDatabaseAll } from "../../../lib/notion-api";
import { mapTransactionPage } from "../../../lib/transaction-page";

export const dynamic = "force-dynamic";
const fail = (error: unknown) => {
  const quota = databaseUnavailableFailure(error);
  if (quota) return NextResponse.json(quota, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Balance checks unavailable." }, { status: (error as { status?: number }).status ?? 500 });
};
const conflict = () => NextResponse.json({ error: "This check changed on another device. Refresh and review it again." }, { status: 409 });
function connection() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw Object.assign(new Error("Finance connection unavailable."), { status: 503 });
  return { token, scope: mirrorScope(token), store: balanceCheckStore() };
}
async function transactions(token: string): Promise<Transaction[]> {
  return (await queryDatabaseAll(token, process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95")).map(mapTransactionPage);
}
async function accounts(): Promise<Account[]> {
  const response = await readAccountResponse(new NextRequest("http://localhost/api/accounts"));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not verify account balances.");
  return data.accounts;
}
async function handleGET() {
  try {
    const { token, scope, store } = connection();
    const checks = await store.list(scope);
    const entries = checks.length ? await transactions(token) : [];
    const reviewCounts = "reviewCounts" in store ? await store.reviewCounts(scope) : [];
    return NextResponse.json({ checks: checks.map(check => checkView(check, entries)), reviewCounts, recoveryPending: reviewCounts.length > 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export const GET = withMirrorReads(handleGET);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body.accountId !== "string" || !/^[a-f0-9-]{32,36}$/i.test(body.accountId)) return NextResponse.json({ error: "Choose an account." }, { status: 400 });
    const accountId = accountKey(body.accountId);
    const { token, scope, store } = connection();
    const existing = (await store.list(scope)).find(check => check.accountId === accountId);
    const expected = typeof body.expectedVersion === "string" ? body.expectedVersion : null;
    if ((existing?.version ?? null) !== expected) return conflict();
    if (body.action === "include") {
      if (!existing || typeof body.transactionId !== "string") return conflict();
      const entries = await transactions(token);
      const entry = entries.find(transaction => accountKey(transaction.id) === accountKey(body.transactionId));
      if (!entry || cashMovement(entry, accountId) === 0) return NextResponse.json({ error: "That transaction does not move this account's money." }, { status: 400 });
      const next: BalanceCheck = { ...existing, version: randomUUID(), knownTransactionIds: [...new Set([...existing.knownTransactionIds, entry.id])] };
      if (!await store.save(scope, next, expected)) return conflict();
      return NextResponse.json({ check: checkView(next, entries) });
    }
    if (body.action === "close") {
      if (!existing) return conflict();
      const [catalog, entries] = await Promise.all([accounts(), transactions(token)]);
      const account = catalog.find(account => accountKey(account.id) === accountId);
      if (account?.balance == null || Math.abs(money(account.balance - checkView(existing, entries).estimatedActual)) >= 0.01) {
        return NextResponse.json({ error: "The balances still differ. Add missing transactions, update the count, or reconcile first." }, { status: 409 });
      }
      if (!await store.close(scope, accountId, existing.version)) return conflict();
      return NextResponse.json({ success: true });
    }
    if (body.action !== "save" || typeof body.actualBalance !== "number" || !Number.isFinite(body.actualBalance) || Math.abs(body.actualBalance) > 1e12) return NextResponse.json({ error: "Enter a valid actual balance." }, { status: 400 });
    const [catalog, entries] = await Promise.all([accounts(), transactions(token)]);
    const account = catalog.find(account => accountKey(account.id) === accountId);
    if (!account || account.balance == null) return NextResponse.json({ error: "Refresh this account before checking its balance." }, { status: 409 });
    const checkedDay = casablancaDay();
    const next: BalanceCheck = { accountId, version: randomUUID(), actualBalance: money(body.actualBalance), ledgerBalance: account.balance,
      checkedAt: new Date().toISOString(), checkedDay,
      knownTransactionIds: entries.filter(entry => entry.date && entry.date.slice(0, 10) <= checkedDay && cashMovement(entry, accountId) !== 0).map(entry => entry.id) };
    if (!await store.save(scope, next, expected)) return conflict();
    return NextResponse.json({ check: checkView(next, entries) });
  } catch (error) { return fail(error); }
}
