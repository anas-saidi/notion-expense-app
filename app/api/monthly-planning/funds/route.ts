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

const ensureMonthBounds = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return monthBounds(`${month}-01`);
};

const buildFundPayload = (payload: {
  categoryId: string;
  planned: number;
  date: string;
  accountId?: string | null;
}) => {
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: `Plan ${payload.date.slice(0, 7)}` } }] },
    Date: { date: { start: payload.date } },
    Planned: { number: payload.planned },
    Category: { relation: [{ id: payload.categoryId }] },
    "Assignment Type": { select: { name: "Monthly" } },
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
    const res = await fetch(`https://api.notion.com/v1/databases/${FUNDS_DB}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      cache: "no-store",
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Date", date: { on_or_after: bounds.start } },
            { property: "Date", date: { on_or_before: bounds.end } },
            { property: "Category", relation: { is_not_empty: true } },
          ],
        },
        page_size: 100,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to load funds" }, { status: res.status });

    const funds = (data.results ?? []).map((page: any) => ({
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

  try {
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
      const updateRes = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({
          properties: buildFundPayload({
            categoryId,
            planned,
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
        fund: { id: updateData.id, categoryId, planned },
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
