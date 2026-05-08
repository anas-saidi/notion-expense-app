import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "@/app/components/app-utils";

const FUNDS_DB = "1936a2be-8922-8058-990d-c549172f1d45";
const TRANSACTIONS_DB = "1926a2be-8922-80be-968a-efa6e6dace95";

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

const sumByCategory = (pages: any[], valueGetter: (page: any) => number) => {
  const totals = new Map<string, number>();

  for (const page of pages) {
    const categoryId = page.properties.Category?.relation?.[0]?.id ?? null;
    if (!categoryId) continue;
    const nextValue = (totals.get(categoryId) ?? 0) + valueGetter(page);
    totals.set(categoryId, nextValue);
  }

  return Array.from(totals.entries()).map(([categoryId, total]) => ({ categoryId, total }));
};

export async function GET(req: NextRequest) {
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
    const [fundsRes, transactionsRes] = await Promise.all([
      fetch(`https://api.notion.com/v1/databases/${FUNDS_DB}/query`, {
        method: "POST",
        headers: notionHeaders(token),
        cache: "no-store",
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Date", date: { on_or_after: rangeStart } },
              { property: "Date", date: { on_or_before: rangeEnd } },
              { property: "Category", relation: { is_not_empty: true } },
            ],
          },
          page_size: 100,
        }),
      }),
      fetch(`https://api.notion.com/v1/databases/${TRANSACTIONS_DB}/query`, {
        method: "POST",
        headers: notionHeaders(token),
        cache: "no-store",
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Type", select: { equals: "Expense" } },
              { property: "Date", date: { on_or_after: rangeStart } },
              { property: "Date", date: { on_or_before: rangeEnd } },
              { property: "Category", relation: { is_not_empty: true } },
            ],
          },
          page_size: 100,
        }),
      }),
    ]);

    const [fundsData, transactionsData] = await Promise.all([fundsRes.json(), transactionsRes.json()]);

    if (!fundsRes.ok) {
      return NextResponse.json({ error: fundsData.message || "Failed to load funds" }, { status: fundsRes.status });
    }

    if (!transactionsRes.ok) {
      return NextResponse.json({ error: transactionsData.message || "Failed to load transactions" }, { status: transactionsRes.status });
    }

    const totalAssigned = (fundsData.results ?? []).reduce((sum: number, page: any) => {
      return sum + (page.properties.Planned?.number ?? 0);
    }, 0);

    const totalSpent = (transactionsData.results ?? []).reduce((sum: number, page: any) => {
      return sum + (page.properties.Amount?.number ?? 0);
    }, 0);

    const assignedByCategory = sumByCategory(fundsData.results ?? [], (page) => page.properties.Planned?.number ?? 0);
    const spentByCategory = sumByCategory(transactionsData.results ?? [], (page) => page.properties.Amount?.number ?? 0);

    return NextResponse.json({
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
    return NextResponse.json({ error: err.message || "Failed to load monthly summary" }, { status: 500 });
  }
}
