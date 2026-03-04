import { NextRequest, NextResponse } from "next/server";

const TRANSACTIONS_DB = "1926a2be-8922-80be-968a-efa6e6dace95";

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { name, amount, accountId, categoryId, date, txType } = await req.json();

  if (!name || !amount || !accountId || !categoryId || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: TRANSACTIONS_DB },
        properties: {
          Name: { title: [{ text: { content: name } }] },
          Amount: { number: parseFloat(amount) },
          Date: { date: { start: date } },
          Account: { relation: [{ id: accountId }] },
          Category: { relation: [{ id: categoryId }] },
          Type: { select: { name: txType ?? "Expense" } },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message, full: data }, { status: res.status });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
