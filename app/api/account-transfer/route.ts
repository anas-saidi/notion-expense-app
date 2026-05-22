import { NextRequest, NextResponse } from "next/server";
import { notionFetchJson } from "@/lib/notion-api";

const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const PROP_ACCOUNT_IN = "\u{1F3E6} account ( in )";
const PROP_ACCOUNT_OUT = "\u{1F3E6} account ( out )";

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { fromAccountId, toAccountId, amount, date, note } = await req.json();
  if (!fromAccountId || !toAccountId || amount === undefined || amount === null || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "Source and destination accounts must be different" }, { status: 400 });
  }

  const parsedAmount = parseFloat(String(amount));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const { data } = await notionFetchJson<any>(token, "/pages", {
      method: "POST",
      body: {
        parent: { database_id: TRANSACTIONS_DB },
        properties: {
          Name: {
            title: [{ text: { content: String(note || "").trim() || "Account transfer" } }],
          },
          Amount: { number: parsedAmount },
          Date: { date: { start: date } },
          Type: { select: { name: "Transfer" } },
          [PROP_ACCOUNT_OUT]: { relation: [{ id: fromAccountId }] },
          [PROP_ACCOUNT_IN]: { relation: [{ id: toAccountId }] },
        },
      },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const status = err instanceof Error && "status" in err ? Number((err as Error & { status?: number }).status) : 500;
    const message = err instanceof Error ? err.message : "Failed to move money";
    return NextResponse.json({ error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
