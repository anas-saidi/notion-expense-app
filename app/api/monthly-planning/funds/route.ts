import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "@/app/components/app-utils";

const NOTION_VERSION = "2022-06-28";
const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const normalizeId = (id: string) => id.replace(/-/g, "").toLowerCase();

const belongsToFundsDatabase = (page: any) =>
  page?.parent?.type === "database_id" && normalizeId(page.parent.database_id) === normalizeId(FUNDS_DB);

async function fetchFundPage(token: string, id: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: notionHeaders(token),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) return { error: NextResponse.json({ error: data.message || "Funding transaction not found" }, { status: response.status }) };
  if (!belongsToFundsDatabase(data)) {
    return { error: NextResponse.json({ error: "Record does not belong to the configured funds database" }, { status: 403 }) };
  }
  return { page: data };
}

async function getCategoryAvailable(token: string, categoryId: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${categoryId}`, {
    headers: notionHeaders(token),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not check the category balance");
  const available = data.properties?.Available?.formula?.number ?? data.properties?.Available?.number;
  if (!Number.isFinite(available)) throw new Error("The category's available balance could not be verified");
  return Math.max(0, Number(available));
}

async function assertFundReductionIsAvailable(token: string, page: any, nextPlanned: number) {
  const currentPlanned = Number(page.properties?.Planned?.number ?? 0);
  const reduction = Math.max(0, currentPlanned - nextPlanned);
  if (reduction === 0) return null;
  const categoryId = page.properties?.Category?.relation?.[0]?.id;
  if (!categoryId) return "Funding transaction has no category";
  const available = await getCategoryAvailable(token, categoryId);
  if (reduction > available) {
    const minimum = Math.max(0, currentPlanned - available);
    return `Only ${available.toLocaleString("en-US")} MAD is still available. This fund cannot be reduced below ${minimum.toLocaleString("en-US")} MAD.`;
  }
  return null;
}

const ensureMonthBounds = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return monthBounds(`${month}-01`);
};

const buildFundPayload = (payload: {
  categoryId: string;
  planned: number;
  date: string;
  accountId?: string | null;
  assignmentType?: string;
  reverse?: boolean;
}) => {
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: `Plan ${payload.date.slice(0, 7)}` } }] },
    Date: { date: { start: payload.date } },
    Planned: { number: payload.planned },
    Category: { relation: [{ id: payload.categoryId }] },
    "Assignment Type": { select: { name: payload.assignmentType ?? "Monthly" } },
    Reverse: { checkbox: payload.reverse ?? false },
  };

  if (payload.accountId) {
    properties["🏦 Accounts"] = { relation: [{ id: payload.accountId }] };
  }

  return properties;
};

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  const bounds = ensureMonthBounds(month);
  if (!bounds) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });

  try {
    const results: any[] = [];
    let cursor: string | undefined;

    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${FUNDS_DB}/query`, {
        method: "POST",
        headers: notionHeaders(token),
        cache: "no-store",
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Date", date: { on_or_after: bounds.start } },
              { property: "Date", date: { on_or_before: bounds.end } },
            ],
          },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message || "Failed to load funds" }, { status: res.status });

      results.push(...(data.results ?? []));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    const funds = results.map((page: any) => ({
      id: page.id,
      categoryId: page.properties.Category?.relation?.[0]?.id ?? null,
      planned: page.properties.Planned?.number ?? 0,
      date: page.properties.Date?.date?.start ?? null,
      assignmentType: page.properties["Assignment Type"]?.select?.name ?? null,
      reverse: page.properties.Reverse?.checkbox ?? false,
    })).filter((fund: any) => fund.categoryId);

    return NextResponse.json({ funds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load funds" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body?.month || !body?.categoryId) {
    return NextResponse.json({ error: "Missing month or categoryId" }, { status: 400 });
  }

  const bounds = ensureMonthBounds(body.month);
  if (!bounds) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });

  const planned = Number(body.planned ?? 0);
  const categoryId = String(body.categoryId);
  const accountId = body.accountId ? String(body.accountId) : null;
  const shouldIncrement = body.mode === "increment" || body.increment === true;
  const shouldSet = body.mode === "set";
  const shouldRelease = body.mode === "release";
  // mode:"add" always creates a new "Additional" record — preserves the original Monthly plan
  const shouldAdd = body.mode === "add";

  if ((planned < 0 || planned === 0) && !shouldIncrement && !shouldSet) {
    return NextResponse.json({ fund: null, mode: "skipped" });
  }

  try {
    if (shouldRelease) {
      if (planned <= 0) return NextResponse.json({ fund: null, mode: "skipped" });
      const available = await getCategoryAvailable(token, categoryId);
      if (planned > available) {
        return NextResponse.json({ error: `Only ${available.toLocaleString("en-US")} MAD is currently available to return.` }, { status: 409 });
      }
      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: FUNDS_DB },
          properties: buildFundPayload({
            categoryId,
            planned,
            date: bounds.start,
            accountId,
            assignmentType: "Additional",
            reverse: true,
          }),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return NextResponse.json({ error: createData.message || "Failed to release available funds" }, { status: createRes.status });
      }
      return NextResponse.json({ fund: { id: createData.id, categoryId, planned, reverse: true }, mode: "released" });
    }

    // "add" mode: always create a fresh Additional record, never touch the Monthly one
    if (shouldAdd) {
      if (planned <= 0) {
        return NextResponse.json({ fund: null, mode: "skipped" });
      }
      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: FUNDS_DB },
          properties: buildFundPayload({
            categoryId,
            planned,
            date: bounds.start,
            accountId,
            assignmentType: "Additional",
          }),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return NextResponse.json({ error: createData.message || "Failed to create fund" }, { status: createRes.status });
      }
      return NextResponse.json({
        fund: { id: createData.id, categoryId, planned },
        mode: "added",
      });
    }

    const queryRes = await fetch(`https://api.notion.com/v1/databases/${FUNDS_DB}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      cache: "no-store",
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Category", relation: { contains: categoryId } },
            { property: "Date", date: { on_or_after: bounds.start } },
            { property: "Date", date: { on_or_before: bounds.end } },
            { property: "Reverse", checkbox: { equals: false } },
          ],
        },
        page_size: 1,
      }),
    });

    const queryData = await queryRes.json();
    if (!queryRes.ok) {
      return NextResponse.json({ error: queryData.message || "Failed to query funds" }, { status: queryRes.status });
    }

    const existing = queryData.results?.[0];

    if (existing) {
      const currentPlanned = existing.properties.Planned?.number ?? 0;
      const nextPlanned = Math.max(0, shouldIncrement ? currentPlanned + planned : planned);

      // Skip if already at 0 and result would remain 0
      if (nextPlanned <= 0 && currentPlanned <= 0) {
        return NextResponse.json({ fund: { id: existing.id, categoryId, planned: currentPlanned }, mode: "skipped" });
      }

      const updateRes = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({
          properties: buildFundPayload({
            categoryId,
            planned: nextPlanned,
            date: bounds.start,
            accountId,
          }),
        }),
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        return NextResponse.json({ error: updateData.message || "Failed to update fund" }, { status: updateRes.status });
      }

      return NextResponse.json({
        fund: { id: updateData.id, categoryId, planned: nextPlanned },
        mode: "updated",
      });
    }

    if (planned <= 0) {
      return NextResponse.json({
        fund: null,
        mode: "skipped",
      });
    }

    const createRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: FUNDS_DB },
        properties: buildFundPayload({
          categoryId,
          planned,
          date: bounds.start,
          accountId,
        }),
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      return NextResponse.json({ error: createData.message || "Failed to create fund" }, { status: createRes.status });
    }

    return NextResponse.json({
      fund: { id: createData.id, categoryId, planned },
      mode: "created",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upsert fund" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const planned = Number(body?.planned);
  const date = typeof body?.date === "string" ? body.date : "";
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  if (!id || !Number.isFinite(planned) || planned <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !accountId) {
    return NextResponse.json({ error: "Amount, date, and funding source are required" }, { status: 400 });
  }

  try {
    const stored = await fetchFundPage(token, id);
    if (stored.error) return stored.error;
    const existingCategoryId = stored.page.properties.Category?.relation?.[0]?.id;
    if (!existingCategoryId) return NextResponse.json({ error: "Funding transaction has no category" }, { status: 409 });
    const reductionError = await assertFundReductionIsAvailable(token, stored.page, planned);
    if (reductionError) return NextResponse.json({ error: reductionError }, { status: 409 });
    const assignmentType = stored.page.properties["Assignment Type"]?.select?.name ?? "Additional";

    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({
        properties: buildFundPayload({
          categoryId: existingCategoryId,
          planned,
          date,
          accountId,
          assignmentType,
        }),
      }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || "Failed to update funding transaction" }, { status: response.status });
    return NextResponse.json({ success: true, fund: { id: data.id, categoryId: existingCategoryId, planned, date, accountId } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update funding transaction" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const stored = await fetchFundPage(token, id);
    if (stored.error) return stored.error;
    const reductionError = await assertFundReductionIsAvailable(token, stored.page, 0);
    if (reductionError) return NextResponse.json({ error: reductionError }, { status: 409 });
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || "Failed to delete funding transaction" }, { status: response.status });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete funding transaction" }, { status: 500 });
  }
}
