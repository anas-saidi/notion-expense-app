import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "@/app/components/app-utils";

const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

type IncomeItem = {
  id: string;
  name: string;
  accountId: string | null;
  amount: number;
  date: string;
};

function buildMockIncome(month: string) {
  const { start } = monthBounds(`${month}-01`);
  const items: IncomeItem[] = [
    { id: "mock-income-1", name: "Salary", accountId: null, amount: 18500, date: start },
    { id: "mock-income-2", name: "Side income", accountId: null, amount: 2200, date: start },
  ];

  return {
    items,
    total: items.reduce((sum, item) => sum + item.amount, 0),
    source: "mock" as const,
  };
}

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  }

  const { start, end } = monthBounds(`${month}-01`);

  if (!token) {
    return NextResponse.json(buildMockIncome(month));
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${TRANSACTIONS_DB}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      cache: "no-store",
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Type", select: { equals: "Income" } },
            { property: "Date", date: { on_or_after: start } },
            { property: "Date", date: { on_or_before: end } },
          ],
        },
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 100,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.message || "Failed to load monthly income" }, { status: res.status });
    }

    const items: IncomeItem[] = (data.results ?? []).map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "Income",
      accountId: page.properties.Account?.relation?.[0]?.id ?? null,
      amount: page.properties.Amount?.number ?? 0,
      date: page.properties.Date?.date?.start ?? start,
    }));

    return NextResponse.json({
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      source: "live" as const,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load monthly income";
    return NextResponse.json({ error: message, ...buildMockIncome(month) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Income";
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : new Date().toISOString().slice(0, 10);
  const amount = Number(body?.amount);

  if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: TRANSACTIONS_DB },
        properties: {
          Name: { title: [{ text: { content: name } }] },
          Amount: { number: amount },
          Date: { date: { start: date } },
          Account: { relation: [{ id: accountId }] },
          Type: { select: { name: "Income" } },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to create income", full: data }, { status: res.status });

    return NextResponse.json({
      income: {
        id: data.id,
        name,
        accountId,
        amount,
        date,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create income";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
