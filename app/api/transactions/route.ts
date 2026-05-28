import { NextRequest, NextResponse } from "next/server";

const TRANSACTIONS_DB = "1926a2be-8922-80be-968a-efa6e6dace95";
const NOTION_VERSION = "2022-06-28";
const PROP_BUDGET_IN  = "\u{1F4B0} budget (in)";
const PROP_BUDGET_OUT = "\u{1F4B0} budget (out)";

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(parseInt(searchParams.get("page_size") ?? "10", 10) || 10, 100);
  const start = searchParams.get("start");
  const end   = searchParams.get("end");

  const dateFilter = start && end ? {
    and: [
      { property: "Date", date: { on_or_after: start } },
      { property: "Date", date: { on_or_before: end } },
    ],
  } : undefined;

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${TRANSACTIONS_DB}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      cache: "no-store",
      body: JSON.stringify({
        ...(dateFilter ? { filter: dateFilter } : {}),
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: pageSize,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const transactions = data.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "",
      amount: page.properties.Amount?.number ?? 0,
      date: page.properties.Date?.date?.start ?? "",
      category: page.properties.Category?.relation?.[0]?.id ?? null,
      accountId: page.properties.Account?.relation?.[0]?.id ?? null,
      type: page.properties.Type?.select?.name ?? "Expense",
      fromCategoryId: page.properties[PROP_BUDGET_OUT]?.relation?.[0]?.id ?? null,
      toCategoryId:   page.properties[PROP_BUDGET_IN]?.relation?.[0]?.id  ?? null,
    }));

    return NextResponse.json({ transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { id, name, amount, accountId, categoryId, date } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!name || amount === undefined || amount === null || !accountId || !categoryId || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const parsedAmount = parseFloat(String(amount));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({
        properties: {
          Name: { title: [{ text: { content: String(name).trim() } }] },
          Amount: { number: parsedAmount },
          Date: { date: { start: date } },
          Account: { relation: [{ id: accountId }] },
          Category: { relation: [{ id: categoryId }] },
          Type: { select: { name: "Expense" } },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message, full: data }, { status: res.status });

    return NextResponse.json({
      success: true,
      transaction: {
        id: data.id,
        name: data.properties.Name?.title?.[0]?.plain_text ?? String(name).trim(),
        amount: data.properties.Amount?.number ?? parsedAmount,
        date: data.properties.Date?.date?.start ?? date,
        category: data.properties.Category?.relation?.[0]?.id ?? categoryId,
        accountId: data.properties.Account?.relation?.[0]?.id ?? accountId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
