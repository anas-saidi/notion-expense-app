import { withMirrorReads } from "../../../lib/mirror/routes";
import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "../../components/app-utils";
import { mapTransactionPage } from "../../../lib/transaction-page";
import { queryDatabaseAll } from "../../../lib/notion-api";

const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be-8922-8058-990d-c549172f1d45";
const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";

const sumByCategory = (pages: any[], valueGetter: (page: any) => number) => {
  const totals = new Map<string, number>();
  const firstAccount = new Map<string, string | null>();

  for (const page of pages) {
    const categoryId = page.properties.Category?.relation?.[0]?.id ?? null;
    if (!categoryId) continue;
    const accountId = page.properties["🏦 Accounts"]?.relation?.[0]?.id ?? null;
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + valueGetter(page));
    if (!firstAccount.has(categoryId)) firstAccount.set(categoryId, accountId);
  }

  return Array.from(totals.entries()).map(([categoryId, total]) => ({
    categoryId,
    total,
    accountId: firstAccount.get(categoryId) ?? null,
  }));
};

const signedPlannedAmount = (page: any) => {
  const amount = page.properties.Planned?.number ?? 0;
  return page.properties.Reverse?.checkbox ? -amount : amount;
};

async function handleGET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let rangeStart = start ?? "";
  let rangeEnd = end ?? "";

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
    }
    const bounds = monthBounds(`${month}-01`);
    rangeStart = bounds.start;
    rangeEnd = bounds.end;
  }

  if (!rangeStart || !rangeEnd) {
    return NextResponse.json({ error: "Missing month or start/end date" }, { status: 400 });
  }

  try {
    const includeTransactions = searchParams.get("includeTransactions") === "true";
    const [funds, transactionPages] = await Promise.all([
      queryDatabaseAll(token, FUNDS_DB, {
        filter: {
          and: [
            { property: "Date", date: { on_or_after: rangeStart } },
            { property: "Date", date: { on_or_before: rangeEnd } },
            { property: "Category", relation: { is_not_empty: true } },
          ],
        },
      }),
      queryDatabaseAll(token, TRANSACTIONS_DB, {
        filter: {
          and: [
            ...(!includeTransactions ? [{ property: "Type", select: { equals: "Expense" } }] : [{ property: "Type", select: { does_not_equal: "Due" } }]),
            { property: "Date", date: { on_or_after: rangeStart } },
            { property: "Date", date: { on_or_before: rangeEnd } },
            ...(!includeTransactions ? [{ property: "Category", relation: { is_not_empty: true } }] : []),
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      }),
    ]);

    const transactions = transactionPages.filter((page: any) =>
      page.properties?.Type?.select?.name === "Expense" && page.properties?.Category?.relation?.length > 0);
    const totalAssigned = funds.reduce(
      (sum: number, page: any) => sum + signedPlannedAmount(page),
      0,
    );

    const totalSpent = transactions.reduce((sum: number, page: any) => {
      return sum + (page.properties.Amount?.number ?? 0);
    }, 0);

    const assignedByCategory = sumByCategory(funds, signedPlannedAmount);
    const spentByCategory = sumByCategory(transactions, (page) => page.properties.Amount?.number ?? 0);

    return NextResponse.json({
      ...(includeTransactions ? {
        transactions: transactionPages.map(mapTransactionPage),
        funds: funds.map((page: any) => ({
          categoryId: page.properties.Category?.relation?.[0]?.id,
          planned: page.properties.Planned?.number ?? 0,
          reverse: page.properties.Reverse?.checkbox ?? false,
        })),
      } : {}),
      summary: {
        month: month ?? null,
        start: rangeStart,
        end: rangeEnd,
        totalAssigned,
        totalSpent,
        assignedByCategory,
        spentByCategory,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load monthly summary" }, { status: err.status ?? 500 });
  }
}

export const GET = withMirrorReads(handleGET);

// Background imports need the same bounded lifetime as explicit sync.
export const maxDuration = 240;
