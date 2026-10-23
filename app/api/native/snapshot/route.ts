import { createHash } from "node:crypto";
import { calculateContributionStatus } from "../../../components/contribution-utils";
import { NextRequest, NextResponse } from "next/server";
import { authenticateNative } from "../../../../lib/native/auth";
import { GET as readCategories } from "../../categories/route";
import { GET as readAccounts } from "../../accounts/route";
import { GET as readMonthly } from "../../monthly-summary/route";
import { GET as readBills } from "../../bills/route";
import { getCategoryScope, resolveTransactionScopes, scopeFromAccountLabel } from "../../../components/app-utils";
import type { BillOccurrence } from "../../../../lib/bills";
import { deriveOccurrences } from "../../../../lib/bills";
import type { Category, Account, Transaction } from "../../../components/app-types";

export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function GET(request: NextRequest) {
  const auth = authenticateNative(request);
  if (auth) return auth;
  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Choose a valid month" }, { status: 400 });
  const url = new URL("/api/monthly-summary", request.url);
  url.searchParams.set("month", month);
  url.searchParams.set("includeTransactions", "true");
  url.searchParams.set("includeJointDebt", "true");
  try {
    const responses = await Promise.all([readCategories(new NextRequest(new URL("/api/categories?includeSnoozed=true&includeArchived=true", request.url))), readAccounts(request), readMonthly(new NextRequest(url))]);
    for (const response of responses) if (!response.ok) return new NextResponse(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const [categoryData, accountData, monthly] = await Promise.all(responses.map(response => response.json()));
    const categories: Category[] = categoryData.categories.filter((category: Category) => !category.archived);
    const accounts: Account[] = accountData.accounts;
    let bills: (BillOccurrence & { scope: string | null })[] = [];
    let billsError: string | null = null;
    try {
      const response = await readBills();
      if (!response.ok) throw new Error("Bills could not be loaded");
      const data = await response.json();
      bills = deriveOccurrences(data.schedules, data.payments, data.today, month)
        .filter(bill => bill.period === month || ((bill.state === "Due" || bill.state === "Overdue") && bill.dueDate < month + "-01"))
        .map(bill => ({ ...bill, scope: (() => { const category = categories.find(c => c.id === bill.categoryId); return category ? getCategoryScope(category, accounts) : null; })() }));
    } catch { billsError = "Bills are unavailable. Pull to refresh to try again."; }
    return NextResponse.json({
      schemaVersion: 1, householdID: createHash("sha256").update(process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd").digest("hex"), month, fetchedAt: new Date().toISOString(), bills, billsError,
      categories: categories.map(category => ({ ...category, scope: getCategoryScope(category, accounts) })),
      accounts: accounts.map(account => ({ ...account, scope: scopeFromAccountLabel(account.label) })),
      transactions: monthly.transactions.map((transaction: Transaction) => ({ ...transaction, scopes: resolveTransactionScopes(transaction, categories, accounts) })),
      summary: monthly.summary,
      contributions: calculateContributionStatus({ accounts, categories, transactions: monthly.transactions, debtTransactions: monthly.jointDebtTransactions, debtCategories: categoryData.categories, monthlySummary: monthly.summary }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load finances. Your saved data is still on the phone." }, { status: 502 });
  }
}
