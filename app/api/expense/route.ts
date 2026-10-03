import { withMirrorMutation } from "../../../lib/mirror/routes";
import { NextRequest, NextResponse } from "next/server";
import { createRecurringExpense } from "@/lib/notion-bills";
import { createNotionExpense } from "@/lib/notion-transactions";

async function handlePOST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { name, amount, accountId, categoryId, date, repeat, billId } = await req.json();

  if (!name || !amount || !accountId || !categoryId || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const parsedAmount = parseFloat(String(amount));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  try {
    if (repeat !== undefined && !["None", "Monthly", "Yearly"].includes(repeat)) return NextResponse.json({ error: "Invalid repeat interval" }, { status: 400 });
    const input = {
      name: String(name).trim(),
      amount: parsedAmount,
      accountId,
      categoryId,
      date,
    };
    const transaction = repeat && repeat !== "None" ? await createRecurringExpense(token, { ...input, repeat, billId }) : await createNotionExpense(token, input);
    return NextResponse.json({ success: true, id: transaction.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, full: err.full, billId: err.billId }, { status: err.status ?? 500 });
  }
}

export const POST = withMirrorMutation(handlePOST);

// Background imports need the same bounded lifetime as explicit sync.
export const maxDuration = 240;
