import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const PROP_BUDGET_IN = "\u{1F4B0} budget (in)";
const PROP_BUDGET_OUT = "\u{1F4B0} budget (out)";

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { fromCategoryId, toCategoryId, amount, date, note } = await req.json();

  if (!fromCategoryId || !toCategoryId || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (fromCategoryId === toCategoryId) {
    return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
  }

  const parsedAmount = parseFloat(amount);
  if (!isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: TRANSACTIONS_DB },
        properties: {
          Name: {
            title: [{ text: { content: note?.trim() || "Budget rebalance" } }],
          },
          Amount: { number: parsedAmount },
          Date: { date: { start: date } },
          Type: { select: { name: "Transfer" } },
          [PROP_BUDGET_IN]: { relation: [{ id: toCategoryId }] },
          [PROP_BUDGET_OUT]: { relation: [{ id: fromCategoryId }] },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.message ?? "Notion error", full: data }, { status: res.status });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
