import { NextRequest, NextResponse } from "next/server";
import type { MonthCloseAccountSnapshot, MonthCloseChecklistItem, MonthCloseMissingTransaction, MonthCloseSummary } from "@/app/components/app-types";
import { monthBounds } from "@/app/components/app-utils";

export const dynamic = "force-dynamic";

const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const PENDING_DB = process.env.NOTION_PENDING_DB ?? "d2db101b-faec-467d-8c57-eee6d8780311";
const RECONCILIATIONS_DB = process.env.NOTION_RECONCILIATIONS_DB ?? "";

type NotionProp = { name: string; type: string };
type NotionPage = Record<string, any>;
type QueryFilter = Record<string, unknown>;
type DatabaseKeys = Record<string, string | undefined>;

const HDR = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const isSavingsAccountType = (value: string | null | undefined) => {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("saving");
};

const pickByTypeAndAliases = (props: NotionProp[], type: string, aliases: string[]) => {
  const sameType = props.filter((prop) => prop.type === type);
  for (const alias of aliases) {
    const found = sameType.find((prop) => norm(prop.name) === norm(alias));
    if (found) return found.name;
  }
  return sameType[0]?.name;
};

const readNumber = (page: NotionPage, key?: string) => {
  if (!key) return null;
  const prop = page.properties?.[key];
  return prop?.number ?? prop?.formula?.number ?? prop?.rollup?.number ?? null;
};

const readTitle = (page: NotionPage, key?: string) => {
  if (!key) return "";
  return page.properties?.[key]?.title?.[0]?.plain_text ?? "";
};

const readDate = (page: NotionPage, key?: string) => {
  if (!key) return null;
  return page.properties?.[key]?.date?.start ?? null;
};

const readSelect = (page: NotionPage, key?: string) => {
  if (!key) return null;
  return page.properties?.[key]?.select?.name ?? null;
};

const readRelationId = (page: NotionPage, key?: string) => {
  if (!key) return null;
  return page.properties?.[key]?.relation?.[0]?.id ?? null;
};

async function getDatabaseKeys(token: string, databaseId: string, definitions: Array<{ name: string; type: string; aliases: string[] }>) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
    headers: HDR(token),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to read Notion schema");

  const props = Object.entries(data.properties ?? {}).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type,
  }));

  const keys: DatabaseKeys = {};
  for (const definition of definitions) {
    keys[definition.name] = pickByTypeAndAliases(props, definition.type, definition.aliases);
  }

  return keys;
}

async function queryDatabase(token: string, databaseId: string, filter?: QueryFilter) {
  const results: NotionPage[] = [];
  let cursor: string | undefined;

  while (true) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: HDR(token),
      cache: "no-store",
      body: JSON.stringify({
        filter,
        page_size: 100,
        start_cursor: cursor,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to query Notion");

    results.push(...(data.results ?? []));
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return results;
}

function buildMockSummary(month: string): MonthCloseSummary {
  const { start, end } = monthBounds(`${month}-01`);
  const accounts: MonthCloseAccountSnapshot[] = [
    {
      accountId: "mock-main",
      label: "Main checking",
      icon: "🏦",
      type: "Checking",
      currentBalance: 18250,
      lastReconciledBalance: 18000,
      lastReconciledAt: end,
      discrepancy: 250,
      status: "attention",
    },
    {
      accountId: "mock-cash",
      label: "Cash wallet",
      icon: "💵",
      type: "Cash",
      currentBalance: 640,
      lastReconciledBalance: 640,
      lastReconciledAt: end,
      discrepancy: 0,
      status: "complete",
    },
  ];
  const missingTransactions: MonthCloseMissingTransaction[] = [
    {
      id: "mock-pending-1",
      name: "Groceries receipt to review",
      amount: 320,
      date: end,
      addedBy: "Wife",
      categoryId: null,
    },
  ];
  const checklist: MonthCloseChecklistItem[] = [
    {
      id: "missing-transactions",
      label: "Review missing transactions",
      description: "1 pending item still needs to be converted into a real transaction.",
      status: "attention",
    },
    {
      id: "balance-sync",
      label: "Sync account balances",
      description: "1 account still has a balance discrepancy against its latest reconciliation.",
      status: "attention",
    },
    {
      id: "reconciliation-status",
      label: "Reconciliation status",
      description: "Latest synced balances are available for the active accounts in this mock snapshot.",
      status: "complete",
    },
  ];

  return {
    month,
    start,
    end,
    checklist,
    missingTransactions,
    accounts,
    unresolvedCount: checklist.filter((item) => item.status === "attention").length,
    source: "mock",
  };
}

function computeChecklist(missingTransactions: MonthCloseMissingTransaction[], accounts: MonthCloseAccountSnapshot[], hasReconciliationData: boolean) {
  const discrepantAccounts = accounts.filter((account) => (account.discrepancy ?? 0) !== 0);
  const accountsWithoutSync = accounts.filter((account) => !account.lastReconciledAt);

  const checklist: MonthCloseChecklistItem[] = [
    {
      id: "missing-transactions",
      label: "Review missing transactions",
      description:
        missingTransactions.length > 0
          ? `${missingTransactions.length} pending item${missingTransactions.length === 1 ? "" : "s"} dated in or before this month still need review.`
          : "No pending items were found for this month window.",
      status: missingTransactions.length > 0 ? "attention" : "complete",
    },
    {
      id: "balance-sync",
      label: "Sync account balances",
      description:
        discrepantAccounts.length > 0
          ? `${discrepantAccounts.length} account${discrepantAccounts.length === 1 ? "" : "s"} have a balance discrepancy against the latest synced value.`
          : "All tracked accounts match their latest synced balance.",
      status: discrepantAccounts.length > 0 ? "attention" : "complete",
    },
    {
      id: "reconciliation-status",
      label: "Reconciliation status",
      description: !hasReconciliationData
        ? "Reconciliation data is not configured yet, so this section is using current balances only."
        : accountsWithoutSync.length > 0
          ? `${accountsWithoutSync.length} account${accountsWithoutSync.length === 1 ? "" : "s"} still need an initial reconciliation snapshot.`
          : "Every tracked account has at least one reconciliation snapshot.",
      status: !hasReconciliationData ? "pending" : accountsWithoutSync.length > 0 ? "attention" : "complete",
    },
  ];

  return checklist;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ summary: buildMockSummary(month) });

  const { start, end } = monthBounds(`${month}-01`);

  try {
    const [accountKeys, pendingKeys, reconciliationKeys] = await Promise.all([
      getDatabaseKeys(token, ACCOUNTS_DB, [
        { name: "title", type: "title", aliases: ["Name", "Account", "Title"] },
        { name: "disabled", type: "checkbox", aliases: ["Disabled", "Archived", "Inactive"] },
        { name: "type", type: "select", aliases: ["Account Type", "Type"] },
        { name: "balanceFormula", type: "formula", aliases: ["Current Balance", "Balance"] },
        { name: "balanceNumber", type: "number", aliases: ["Current Balance", "Balance"] },
        { name: "balanceRollup", type: "rollup", aliases: ["Current Balance", "Balance"] },
      ]),
      getDatabaseKeys(token, PENDING_DB, [
        { name: "title", type: "title", aliases: ["Name", "Title", "Item", "Pending"] },
        { name: "amount", type: "number", aliases: ["Amount", "Price", "Cost"] },
        { name: "date", type: "date", aliases: ["Date", "Due", "Planned", "When"] },
        { name: "addedBy", type: "select", aliases: ["Added By", "AddedBy", "Owner"] },
        { name: "category", type: "relation", aliases: ["Category", "Categories"] },
      ]),
      RECONCILIATIONS_DB
        ? getDatabaseKeys(token, RECONCILIATIONS_DB, [
            { name: "account", type: "relation", aliases: ["Account", "Accounts"] },
            { name: "date", type: "date", aliases: ["Date", "Sync Date", "Reconciled At"] },
            { name: "balance", type: "number", aliases: ["Balance", "Closing Balance", "Synced Balance"] },
          ])
        : Promise.resolve(null),
    ]);

    const accountFilter = accountKeys.disabled
      ? { property: accountKeys.disabled, checkbox: { equals: false } }
      : undefined;
    const pendingFilter = pendingKeys.date
      ? {
          and: [
            { property: pendingKeys.date, date: { on_or_before: end } },
          ],
        }
      : undefined;

    const [accountPages, pendingPages, reconciliationPages] = await Promise.all([
      queryDatabase(token, ACCOUNTS_DB, accountFilter),
      queryDatabase(token, PENDING_DB, pendingFilter),
      RECONCILIATIONS_DB && reconciliationKeys ? queryDatabase(token, RECONCILIATIONS_DB) : Promise.resolve([]),
    ]);

    const latestReconciliationByAccount = new Map<string, { balance: number | null; date: string | null }>();
    for (const page of reconciliationPages) {
      const accountId = readRelationId(page, reconciliationKeys?.account);
      const date = readDate(page, reconciliationKeys?.date);
      if (!accountId || !date || date > end) continue;
      const current = latestReconciliationByAccount.get(accountId);
      if (!current || (current.date ?? "") < date) {
        latestReconciliationByAccount.set(accountId, {
          balance: readNumber(page, reconciliationKeys?.balance),
          date,
        });
      }
    }

    const accounts: MonthCloseAccountSnapshot[] = accountPages.map((page) => {
      const accountId = page.id;
      const currentBalance =
        readNumber(page, accountKeys.balanceFormula) ??
        readNumber(page, accountKeys.balanceNumber) ??
        readNumber(page, accountKeys.balanceRollup) ??
        null;
      const latest = latestReconciliationByAccount.get(accountId);
      const discrepancy =
        currentBalance != null && latest?.balance != null
          ? Number((currentBalance - latest.balance).toFixed(2))
          : null;

      return {
        accountId,
        label: readTitle(page, accountKeys.title) || "Unnamed account",
        icon: page.icon?.emoji ?? "🏦",
        type: readSelect(page, accountKeys.type),
        currentBalance,
        lastReconciledBalance: latest?.balance ?? null,
        lastReconciledAt: latest?.date ?? null,
        discrepancy,
        status: discrepancy == null ? "pending" : discrepancy === 0 ? "complete" : "attention",
      };
    });

    const activePlanningAccounts = accounts.filter((account) => !isSavingsAccountType(account.type));

    const missingTransactions: MonthCloseMissingTransaction[] = pendingPages
      .filter((page) => {
        const date = readDate(page, pendingKeys.date);
        return !date || date >= start;
      })
      .map((page) => ({
        id: page.id,
        name: readTitle(page, pendingKeys.title),
        amount: readNumber(page, pendingKeys.amount),
        date: readDate(page, pendingKeys.date),
        addedBy: readSelect(page, pendingKeys.addedBy),
        categoryId: readRelationId(page, pendingKeys.category),
      }));

    const checklist = computeChecklist(missingTransactions, activePlanningAccounts, Boolean(RECONCILIATIONS_DB));
    const summary: MonthCloseSummary = {
      month,
      start,
      end,
      checklist,
      missingTransactions,
      accounts: activePlanningAccounts,
      unresolvedCount: checklist.filter((item) => item.status === "attention").length,
      source: "live",
    };

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load month close summary";
    return NextResponse.json({ error: message, summary: buildMockSummary(month) }, { status: 500 });
  }
}
