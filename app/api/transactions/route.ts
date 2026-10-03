import { withMirrorReads, withMirrorMutation } from "../../../lib/mirror/routes";
import { NextRequest, NextResponse } from "next/server";
import { mapTransactionPage as mapPage } from "../../../lib/transaction-page";
import { notionFetchJson } from "../../../lib/notion-api";
import { assertExpenseFitsBudget } from "@/lib/notion-transactions";

const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const NOTION_VERSION = "2022-06-28";
const PROP_BUDGET_IN   = "\u{1F4B0} budget (in)";
const PROP_BUDGET_OUT  = "\u{1F4B0} budget (out)";
const PROP_ACCOUNT_IN  = "\u{1F3E6} account ( in )";
const PROP_ACCOUNT_OUT = "\u{1F3E6} account ( out )";

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const normalizeId = (value: string | undefined | null) => (value ?? "").replace(/-/g, "").toLowerCase();

const belongsToTransactionsDatabase = (page: any) =>
  page?.parent?.type === "database_id" && normalizeId(page.parent.database_id) === normalizeId(TRANSACTIONS_DB);


async function fetchTransactionPage(token: string, id: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: notionHeaders(token),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) return { error: NextResponse.json({ error: data.message || "Transaction not found" }, { status: response.status }) };
  if (!belongsToTransactionsDatabase(data)) {
    return { error: NextResponse.json({ error: "Transaction does not belong to the configured transactions database" }, { status: 403 }) };
  }
  return { page: data };
}

async function handleGET(req: NextRequest) {
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
    // Date-range and explicit all-time reports must include every page.
    // When no date filter (open-ended), respect the explicit page_size cap.
    const paginate = !!dateFilter || searchParams.get("all") === "true";
    const allResults: any[] = [];
    let cursor: string | undefined;

    do {
      const { data } = await notionFetchJson<any>(token, `/databases/${TRANSACTIONS_DB}/query`, {
        method: "POST",
        _mirrorAllRows: paginate,
        body: {
          filter: { and: [{ property: "Type", select: { does_not_equal: "Due" } }, ...(dateFilter?.and ?? [])] },
          sorts: [{ property: "Date", direction: "descending" }],
          page_size: paginate ? 100 : pageSize,
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      });

      allResults.push(...data.results);
      cursor = (paginate && data.has_more) ? data.next_cursor : undefined;
    } while (cursor);

    const financialResults = allResults.filter(page => page.properties?.Type?.select?.name !== "Due");
    const results = paginate ? financialResults : financialResults.slice(0, pageSize);
    return NextResponse.json({ transactions: results.map(mapPage) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

async function handlePATCH(req: NextRequest) {
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
    const stored = await fetchTransactionPage(token, id);
    if (stored.error) return stored.error;
    const existingType = stored.page.properties?.Type?.select?.name;
    if (!existingType) {
      return NextResponse.json({ error: "Legacy transaction has no type and cannot be edited safely. Set its type in Notion first." }, { status: 409 });
    }
    if (existingType !== "Expense") {
      return NextResponse.json({ error: `${existingType} transactions are read-only in the expense editor` }, { status: 409 });
    }

    // Only the increase has to fit when the expense stays in its category.
    const storedCategory = stored.page.properties?.Category?.relation?.[0]?.id ?? null;
    const storedAmount = stored.page.properties?.Amount?.number ?? 0;
    const sameCategory = storedCategory?.replace(/-/g, "") === String(categoryId).replace(/-/g, "");
    try {
      await assertExpenseFitsBudget(token, { categoryId, amount: parsedAmount, originalAmount: sameCategory ? storedAmount : 0 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message, full: error.full }, { status: error.status ?? 500 });
    }

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
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message, full: data }, { status: res.status });

    return NextResponse.json({
      success: true,
      transaction: mapPage(data),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const stored = await fetchTransactionPage(token, id);
    if (stored.error) return stored.error;
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ success: true, transaction: mapPage(data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Restore only a page already verified to belong to the transactions database. */
async function handlePUT(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const stored = await fetchTransactionPage(token, id);
    if (stored.error) return stored.error;
    // Restoring an expense spends its money again, so it must still fit.
    const restoredCategory = stored.page.properties?.Category?.relation?.[0]?.id;
    if (stored.page.properties?.Type?.select?.name === "Expense" && restoredCategory) {
      try {
        await assertExpenseFitsBudget(token, { categoryId: restoredCategory, amount: stored.page.properties?.Amount?.number ?? 0 });
      } catch (error: any) {
        return NextResponse.json({ error: error.message, full: error.full }, { status: error.status ?? 500 });
      }
    }
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ archived: false }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to restore transaction" }, { status: res.status });
    return NextResponse.json({ success: true, transaction: mapPage(data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to restore transaction" }, { status: 500 });
  }
}

export const GET = withMirrorReads(handleGET);

export const PATCH = withMirrorMutation(handlePATCH);

export const DELETE = withMirrorMutation(handleDELETE);

export const PUT = withMirrorMutation(handlePUT);

// Background imports need the same bounded lifetime as explicit sync.
export const maxDuration = 240;
