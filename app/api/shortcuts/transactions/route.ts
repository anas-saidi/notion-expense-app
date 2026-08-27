import { NextRequest, NextResponse } from "next/server";
import { requireBearerToken } from "@/lib/shortcut-auth";
import { createNotionExpense } from "@/lib/notion-transactions";
import { resolveOption } from "@/lib/shortcut-options";
import {
  getShortcutOptionsSnapshot,
  refreshShortcutOptionsCache,
} from "@/lib/shortcut-service";

export const dynamic = "force-dynamic";

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function optionError(kind: string, result: { error: "missing" | "not_found" | "ambiguous" }) {
  if (result.error === "missing") return `Missing ${kind}; send its name or id.`;
  if (result.error === "ambiguous") return `The ${kind} name matches more than one option; send its id.`;
  return `Unknown ${kind}; fetch /api/shortcuts/options and use a returned name or id.`;
}

function optionLookupValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as { id?: unknown; name?: unknown };
    if (typeof candidate.id === "string") return candidate.id;
    if (typeof candidate.name === "string") return candidate.name;
  }
  return value;
}

export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, "SHORTCUT_API_TOKEN", "Shortcut API");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string"
    ? body.name.trim()
    : typeof body?.description === "string"
      ? body.description.trim()
      : "";
  const amount = typeof body?.amount === "number" || typeof body?.amount === "string"
    ? Number(body.amount)
    : NaN;
  const date = body?.date;
  const categoryInput = body?.categoryId ?? body?.category;
  const accountInput = body?.accountId ?? body?.account;

  if (!name) return NextResponse.json({ error: "Missing name or description." }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "Name must be 200 characters or fewer." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }
  if (!validIsoDate(date)) {
    return NextResponse.json({ error: "Date is required and must use YYYY-MM-DD." }, { status: 400 });
  }

  try {
    let snapshot = await getShortcutOptionsSnapshot();
    if (snapshot.stale) {
      try {
        const refreshed = await refreshShortcutOptionsCache();
        snapshot = {
          options: refreshed.options,
          updatedAt: refreshed.updatedAt,
          stale: false,
          backend: refreshed.backend,
        };
      } catch {
        return NextResponse.json(
          { error: "Shortcut options are stale and could not be refreshed; transaction was not created." },
          { status: 503 },
        );
      }
    }
    const category = resolveOption(
      optionLookupValue(categoryInput),
      snapshot.options.categories,
    );
    if (!("option" in category)) {
      return NextResponse.json({ error: optionError("category", category) }, { status: 400 });
    }
    const account = resolveOption(
      optionLookupValue(accountInput),
      snapshot.options.accounts,
    );
    if (!("option" in account)) {
      return NextResponse.json({ error: optionError("account", account) }, { status: 400 });
    }

    const token = process.env.NOTION_TOKEN;
    if (!token) return NextResponse.json({ error: "NOTION_TOKEN is not configured." }, { status: 503 });

    const transaction = await createNotionExpense(token, {
      name,
      amount,
      date,
      categoryId: category.option.id,
      accountId: account.option.id,
    });

    return NextResponse.json({
      success: true,
      transaction,
      category: { id: category.option.id, name: category.option.name },
      account: { id: account.option.id, name: account.option.name },
    });
  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : 502;
    return NextResponse.json(
      { error: error?.message || "Failed to create transaction." },
      { status },
    );
  }
}
