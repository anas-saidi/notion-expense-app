import { notionLedgerConfigured } from "./notion-ledger";
import { NextRequest } from "next/server";
import { readAccountResponse } from "./notion-accounts";
import { queryDatabaseAll } from "./notion-api";
import { mapCategoryPage } from "./notion-category-record";
import { mapTransactionPage } from "./transaction-page";
import { contributionStore } from "./contribution-store";
import { mirrorScope } from "./mirror/store";
import { contributionLedger } from "./contribution-agreements";
import { monthBounds } from "../app/components/app-utils";
import type { Account } from "../app/components/app-types";
import { billToday } from "./bills";
import { scopeFromAccountLabel } from "../app/components/app-utils";
import { normalizeId } from "./savings-funding";
import { cents } from "./contribution-agreements";

export async function readContributionContext(token: string, month: string, throughDay = monthBounds(`${month}-01`).end) {
  const [accountResponse, categoryPages, transactionPages, agreements] = await Promise.all([
    readAccountResponse(new NextRequest("http://localhost/api/accounts")),
    queryDatabaseAll(token, process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd"),
    queryDatabaseAll(token, process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95", { filter: { and: [
      { property: "Date", date: { on_or_before: throughDay } }, { property: "Type", select: { does_not_equal: "Due" } },
    ] } }),
    contributionStore().list(mirrorScope(token)),
  ]);
  const accountData = await accountResponse.json();
  if (!accountResponse.ok) throw new Error(accountData.error ?? "Could not verify accounts.");
  const accounts: Account[] = accountData.accounts;
  const categories = categoryPages.map(mapCategoryPage);
  const transactions = transactionPages.map(mapTransactionPage);
  return { accounts, categories, transactions, agreements, ledger: contributionLedger(accounts, categories, transactions, agreements, month) };
}

/** Additional allocations from existing Joined cash cannot consume advances.
 * Monthly plans can request new contributions through their capacity check. */
export async function assertAdvanceReservation(token: string, accountId: string | null, categoryId: string, increase: number) {
  if (increase <= 0 || (!notionLedgerConfigured() && !process.env.DATABASE_URL)) return;
  if (!(await contributionStore().list(mirrorScope(token))).length) return;
  const context = await readContributionContext(token, billToday().slice(0, 7));
  const sourceId = accountId ?? context.categories.find(c => normalizeId(c.id) === normalizeId(categoryId))?.defaultAccount;
  const account = context.accounts.find(a => normalizeId(a.id) === normalizeId(sourceId));
  if (!account || /saving/i.test(account.label) || scopeFromAccountLabel(account.label) !== "joint") return;
  const reserved = context.ledger.outstanding.anas + context.ledger.outstanding.salma;
  if (!reserved) return;
  if (account.readyToAssign == null || cents(increase) > cents(account.readyToAssign - reserved)) throw Object.assign(new Error("Joined's unassigned money is reserved for advance repayments. Add funding or reduce other allocations first."), { status: 409 });
}
