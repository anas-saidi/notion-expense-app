import { NextRequest, NextResponse } from "next/server";
import { createNotionExpense } from "@/lib/notion-transactions";

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { name, amount, accountId, categoryId, date } = await req.json();

  if (!name || !amount || !accountId || !categoryId || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const parsedAmount = parseFloat(String(amount));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    const transaction = await createNotionExpense(token, {
      name: String(name).trim(),
      amount: parsedAmount,
      accountId,
      categoryId,
      date,
    });
    return NextResponse.json({ success: true, id: transaction.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, full: err.full }, { status: err.status ?? 500 });
  }
}
