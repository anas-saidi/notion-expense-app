import { withMirrorMutation } from "../../../../lib/mirror/routes";
import { NextRequest, NextResponse } from "next/server";
import { monthBounds } from "../../../components/app-utils";
import { notionFetchJson, queryDatabaseAll } from "../../../../lib/notion-api";

const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";

type AllocationItem = {
  categoryId: string;
  amount: number;
  defaultAccount?: string | null;
};

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
    properties["🏦 Accounts"] = { relation: [{ id: allocation.defaultAccount }] };
  }

  return properties;
};

async function upsertFund(token: string, allocation: AllocationItem, date: string, existing: any, allowClear = false) {
  const properties = buildFundProperties(allocation, date);

  if (existing) {
    // A plan set to 0 archives the fund only when the caller asks (the month plan
    // sheet); other callers never overwrite an existing fund with 0.
    if (allocation.amount <= 0 && allowClear) {
      await notionFetchJson(token, `/pages/${existing.id}`, {
        method: "PATCH",
        body: { archived: true },
      });
      return { id: existing.id, categoryId: allocation.categoryId, planned: 0, mode: "cleared" };
    }
    if (allocation.amount <= 0) {
      return { id: existing.id, categoryId: allocation.categoryId, planned: existing.properties.Planned?.number ?? 0, mode: "skipped" };
    }

    const { data: updateData } = await notionFetchJson<any>(token, `/pages/${existing.id}`, {
      method: "PATCH",
      body: { properties },
    });
    return { id: updateData.id, categoryId: allocation.categoryId, planned: allocation.amount, mode: "updated" };
  }

  if (allocation.amount <= 0) {
    return { id: null, categoryId: allocation.categoryId, planned: allocation.amount, mode: "skipped" };
  }

  const { data: createData } = await notionFetchJson<any>(token, "/pages", {
    method: "POST",
    body: {
      parent: { database_id: FUNDS_DB },
      properties,
    },
  });
  return { id: createData.id, categoryId: allocation.categoryId, planned: allocation.amount, mode: "created" };
}

async function handlePOST(req: NextRequest) {
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
    return NextResponse.json({ error: "NOTION_TOKEN not set; the plan was not saved" }, { status: 500 });
  }

  try {
    // One paginated lookup for the month, rather than a query per category.
    // Use the first matching record, preserving the previous upsert behavior.
    const existingFunds = await queryDatabaseAll<any>(token, FUNDS_DB, {
      filter: { and: [
        { property: "Date", date: { on_or_after: bounds.start } },
        { property: "Date", date: { on_or_before: bounds.end } },
        { property: "Reverse", checkbox: { equals: false } },
      ] },
    });
    const byCategory = new Map<string, any>();
    const normalizeId = (id: string) => id.replace(/-/g, "").toLowerCase();
    for (const fund of existingFunds) {
      for (const category of fund.properties?.Category?.relation ?? []) {
        const key = normalizeId(category.id);
        if (!byCategory.has(key)) byCategory.set(key, fund);
      }
    }
    const savedFunds = [];
    for (const allocation of allocations) {
      savedFunds.push(await upsertFund(token, allocation, bounds.start, byCategory.get(normalizeId(allocation.categoryId)), body.allowClear === true));
    }

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

export const POST = withMirrorMutation(handlePOST);

// Background imports need the same bounded lifetime as explicit sync.
export const maxDuration = 240;
