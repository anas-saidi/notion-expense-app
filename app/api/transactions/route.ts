import { NextRequest, NextResponse } from "next/server";

const TRANSACTIONS_DB = "1926a2be-8922-80be-968a-efa6e6dace95";
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

const mapPage = (page: any) => ({
  id: page.id,
  name: page.properties?.Name?.title?.[0]?.plain_text ?? "",
  amount: page.properties?.Amount?.number ?? 0,
  date: page.properties?.Date?.date?.start ?? "",
  category: page.properties?.Category?.relation?.[0]?.id ?? null,
  accountId: page.properties?.Account?.relation?.[0]?.id ?? null,
  type: page.properties?.Type?.select?.name ?? null,
  fromCategoryId: page.properties?.[PROP_BUDGET_OUT]?.relation?.[0]?.id ?? null,
  toCategoryId: page.properties?.[PROP_BUDGET_IN]?.relation?.[0]?.id ?? null,
  fromAccountId: page.properties?.[PROP_ACCOUNT_OUT]?.relation?.[0]?.id ?? null,
  toAccountId: page.properties?.[PROP_ACCOUNT_IN]?.relation?.[0]?.id ?? null,
});

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
    // When a date range is provided, paginate through all results.
    // When no date filter (open-ended), respect the explicit page_size cap.
    const paginate = !!dateFilter;
    const allResults: any[] = [];
    let cursor: string | undefined;

    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${TRANSACTIONS_DB}/query`, {
        method: "POST",
        headers: notionHeaders(token),
        cache: "no-store",
        body: JSON.stringify({
          ...(dateFilter ? { filter: dateFilter } : {}),
          sorts: [{ property: "Date", direction: "descending" }],
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

      allResults.push(...data.results);
      cursor = (paginate && data.has_more) ? data.next_cursor : undefined;
    } while (cursor);

    const results = paginate ? allResults : allResults.slice(0, pageSize);
    return NextResponse.json({ transactions: results.map(mapPage) });
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
    const stored = await fetchTransactionPage(token, id);
    if (stored.error) return stored.error;
    const existingType = stored.page.properties?.Type?.select?.name;
    if (!existingType) {
      return NextResponse.json({ error: "Legacy transaction has no type and cannot be edited safely. Set its type in Notion first." }, { status: 409 });
    }
    if (existingType !== "Expense") {
      return NextResponse.json({ error: `${existingType} transactions are read-only in the expense editor` }, { status: 409 });
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

export async function DELETE(req: NextRequest) {
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
export async function PUT(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const stored = await fetchTransactionPage(token, id);
    if (stored.error) return stored.error;
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
