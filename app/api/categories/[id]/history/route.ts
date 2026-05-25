import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";

function getLastNMonths(n: number): Array<{ month: string; start: string; end: string }> {
  const result: Array<{ month: string; start: string; end: string }> = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const start = `${monthStr}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const end = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
    result.push({ month: monthStr, start, end });
  }
  return result;
}

async function notionQuery(token: string, databaseId: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion query failed");
  return data;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const monthCount = Math.min(parseInt(searchParams.get("months") ?? "6", 10) || 6, 12);

    const months = getLastNMonths(monthCount);
    const rangeStart = months[0].start;
    const rangeEnd = months[months.length - 1].end;

    const [expenseData, fundsData] = await Promise.all([
      notionQuery(token, TRANSACTIONS_DB, {
        page_size: 200,
        filter: {
          and: [
            { property: "Type", select: { equals: "Expense" } },
            { property: "Category", relation: { contains: id } },
            { property: "Date", date: { on_or_after: rangeStart } },
            { property: "Date", date: { on_or_before: rangeEnd } },
          ],
        },
      }),
      notionQuery(token, FUNDS_DB, {
        page_size: 200,
        filter: {
          and: [
            { property: "Category", relation: { contains: id } },
            { property: "Date", date: { on_or_after: rangeStart } },
            { property: "Date", date: { on_or_before: rangeEnd } },
            { property: "Reverse", checkbox: { equals: false } },
          ],
        },
      }),
    ]);

    const spentByMonth = new Map<string, number>();
    const plannedByMonth = new Map<string, number>();

    for (const page of expenseData.results ?? []) {
      const date: string = page.properties.Date?.date?.start ?? "";
      const month = date.slice(0, 7);
      if (!month) continue;
      const amount: number = page.properties.Amount?.number ?? 0;
      spentByMonth.set(month, (spentByMonth.get(month) ?? 0) + amount);
    }

    for (const page of fundsData.results ?? []) {
      const date: string = page.properties.Date?.date?.start ?? "";
      const month = date.slice(0, 7);
      if (!month) continue;
      const amount: number = page.properties.Planned?.number ?? 0;
      plannedByMonth.set(month, (plannedByMonth.get(month) ?? 0) + amount);
    }

    const history = months.map(({ month }) => ({
      month,
      spent: Math.round(spentByMonth.get(month) ?? 0),
      planned: Math.round(plannedByMonth.get(month) ?? 0),
    }));

    return NextResponse.json({ history });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load category history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
