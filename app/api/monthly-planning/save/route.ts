import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "@/app/components/app-utils";

const NOTION_VERSION = "2022-06-28";
const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";

type AllocationItem = {
  categoryId: string;
  amount: number;
  defaultAccount?: string | null;
};

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const ensureMonthBounds = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return monthBounds(`${month}-01`);
};

const normalizeAllocation = (item: unknown): AllocationItem | null => {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  const categoryId = typeof value.categoryId === "string" ? value.categoryId : "";
  const amount = Number(value.amount ?? 0);
  if (!categoryId || !Number.isFinite(amount)) return null;
  return {
    categoryId,
    amount: Math.max(0, amount),
    defaultAccount: typeof value.defaultAccount === "string" ? value.defaultAccount : null,
  };
};

const mergeAllocations = (...groups: unknown[]) => {
  const merged = new Map<string, AllocationItem>();

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const rawItem of group) {
      const item = normalizeAllocation(rawItem);
      if (!item) continue;
      const current = merged.get(item.categoryId);
      merged.set(item.categoryId, {
        categoryId: item.categoryId,
        amount: (current?.amount ?? 0) + item.amount,
        defaultAccount: current?.defaultAccount ?? item.defaultAccount ?? null,
      });
    }
  }

  return Array.from(merged.values());
};

const buildFundProperties = (allocation: AllocationItem, date: string) => {
  const properties: Record<string, any> = {
    Name: { title: [{ text: { content: `Plan ${date.slice(0, 7)}` } }] },
    Date: { date: { start: date } },
    Planned: { number: allocation.amount },
    Category: { relation: [{ id: allocation.categoryId }] },
    "Assignment Type": { select: { name: "Monthly" } },
  };

  if (allocation.defaultAccount) {
    properties["ðŸ¦ Accounts"] = { relation: [{ id: allocation.defaultAccount }] };
  }

  return properties;
};

async function upsertFund(token: string, allocation: AllocationItem, date: string, end: string) {
  const queryRes = await fetch(`https://api.notion.com/v1/databases/${FUNDS_DB}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    cache: "no-store",
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Category", relation: { contains: allocation.categoryId } },
          { property: "Date", date: { on_or_after: date } },
          { property: "Date", date: { on_or_before: end } },
          { property: "Reverse", checkbox: { equals: false } },
        ],
      },
      page_size: 1,
    }),
  });

  const queryData = await queryRes.json();
  if (!queryRes.ok) throw new Error(queryData.message || "Failed to query funds");

  const existing = queryData.results?.[0];
  const properties = buildFundProperties(allocation, date);

  if (existing) {
    const updateRes = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties }),
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) throw new Error(updateData.message || "Failed to update fund");
    return { id: updateData.id, categoryId: allocation.categoryId, planned: allocation.amount, mode: "updated" };
  }

  if (allocation.amount <= 0) {
    return { id: null, categoryId: allocation.categoryId, planned: allocation.amount, mode: "skipped" };
  }

  const createRes = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { database_id: FUNDS_DB },
      properties,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.message || "Failed to create fund");
  return { id: createData.id, categoryId: allocation.categoryId, planned: allocation.amount, mode: "created" };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.month) {
    return NextResponse.json({ error: "Missing month" }, { status: 400 });
  }

  const bounds = ensureMonthBounds(String(body.month));
  if (!bounds) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const allocations = mergeAllocations(
    body.budgetItems,
    body.householdItems,
    body.wifeItems,
    body.husbandItems,
    body.savingsItems,
  );

  if (!allocations.length) {
    return NextResponse.json({ error: "No allocation items to save" }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
      mode: "mock",
      savedFunds: allocations.map((allocation) => ({
        id: null,
        categoryId: allocation.categoryId,
        planned: allocation.amount,
        mode: "mock",
      })),
      payload: body,
    });
  }

  try {
    const savedFunds = await Promise.all(
      allocations.map((allocation) => upsertFund(token, allocation, bounds.start, bounds.end)),
    );

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
      mode: "notion",
      savedFunds,
      snapshot: body.snapshot ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save monthly plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
