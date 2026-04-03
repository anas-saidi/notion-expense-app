import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const CATEGORIES_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";
const PROP_BUDGET_IN = "\u{1F4B0} budget (in)";
const PROP_BUDGET_OUT = "\u{1F4B0} budget (out)";
const PROP_ACCOUNTS = "\u{1F3E6} Accounts";
const PROP_ACCOUNT_IN = "\u{1F3E6} account ( in )";
const PROP_ACCOUNT_OUT = "\u{1F3E6} account ( out )";

type NotionPage = {
  id: string;
  icon?: { emoji?: string | null } | null;
  properties: Record<string, any>;
};

type TimelineEvent = {
  id: string;
  date: string;
  kind: "funded" | "moved_in" | "moved_out" | "expense";
  amount: number;
  direction: "in" | "out";
  title: string;
  subtitle?: string;
  accountId?: string | null;
  accountName?: string | null;
  relatedCategoryId?: string | null;
  relatedCategoryName?: string | null;
  assignmentType?: "Monthly" | "Top-up" | null;
  sourceDb: "funds" | "transactions";
};

function normalizeId(id: string) {
  return id.replace(/-/g, "").toLowerCase();
}

function getMonthRange(monthParam?: string | null) {
  const base = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? `${monthParam}-01`
    : new Date().toISOString().slice(0, 7) + "-01";
  const start = new Date(`${base}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

  return {
    month: start.toISOString().slice(0, 7),
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function notionQuery(token: string, databaseId: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion query failed");
  return data;
}

async function notionPage(token: string, pageId: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion page fetch failed");
  return data;
}

function titleText(page: NotionPage, property: string) {
  return page.properties[property]?.title?.[0]?.plain_text ?? "";
}

function buildCategoryLookup(results: NotionPage[]) {
  return new Map(
    results.map((page) => [
      normalizeId(page.id),
      {
        id: page.id,
        name: titleText(page, "Category") || "Unnamed",
        icon: page.icon?.emoji ?? null,
      },
    ]),
  );
}

function buildAccountLookup(results: NotionPage[]) {
  return new Map(
    results.map((page) => [
      normalizeId(page.id),
      {
        id: page.id,
        name: titleText(page, "Name") || "Unnamed",
        icon: page.icon?.emoji ?? null,
      },
    ]),
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const token = process.env.NOTION_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  }

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const { month, start, end } = getMonthRange(searchParams.get("month"));
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
    const includeExpenses = searchParams.get("include_expenses") !== "false";

    const [categoryPage, categoriesData, accountsData, fundsData, transferInData, transferOutData, expenseData] = await Promise.all([
      notionPage(token, id),
      notionQuery(token, CATEGORIES_DB, {
        page_size: 100,
        filter: {
          and: [
            { property: "Snooze", checkbox: { equals: false } },
            { property: "Archived", checkbox: { equals: false } },
          ],
        },
      }),
      notionQuery(token, ACCOUNTS_DB, {
        page_size: 100,
        filter: { property: "Disabled", checkbox: { equals: false } },
      }),
      notionQuery(token, FUNDS_DB, {
        page_size: 100,
        filter: {
          and: [
            { property: "Category", relation: { contains: id } },
            { property: "Date", date: { on_or_after: start } },
            { property: "Date", date: { on_or_before: end } },
            { property: "Reverse", checkbox: { equals: false } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      }),
      notionQuery(token, TRANSACTIONS_DB, {
        page_size: 100,
        filter: {
          and: [
            { property: "Type", select: { equals: "Transfer" } },
            { property: PROP_BUDGET_IN, relation: { contains: id } },
            { property: "Date", date: { on_or_after: start } },
            { property: "Date", date: { on_or_before: end } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      }),
      notionQuery(token, TRANSACTIONS_DB, {
        page_size: 100,
        filter: {
          and: [
            { property: "Type", select: { equals: "Transfer" } },
            { property: PROP_BUDGET_OUT, relation: { contains: id } },
            { property: "Date", date: { on_or_after: start } },
            { property: "Date", date: { on_or_before: end } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      }),
      includeExpenses
        ? notionQuery(token, TRANSACTIONS_DB, {
            page_size: 100,
            filter: {
              and: [
                { property: "Type", select: { equals: "Expense" } },
                { property: "Category", relation: { contains: id } },
                { property: "Date", date: { on_or_after: start } },
                { property: "Date", date: { on_or_before: end } },
              ],
            },
            sorts: [{ property: "Date", direction: "descending" }],
          })
        : Promise.resolve({ results: [] }),
    ]);

    const categoryLookup = buildCategoryLookup(categoriesData.results ?? []);
    const accountLookup = buildAccountLookup(accountsData.results ?? []);
    const normalizedCategoryId = normalizeId(id);

    const category = categoryLookup.get(normalizedCategoryId) ?? {
      id: categoryPage.id,
      name: titleText(categoryPage, "Category") || "Unnamed",
      icon: categoryPage.icon?.emoji ?? null,
    };

    const summaryCategory = {
      id: category.id,
      name: category.name,
      icon: category.icon,
      planned: categoryPage.properties.Planned?.number ?? null,
      available:
        categoryPage.properties.Available?.formula?.number
        ?? categoryPage.properties.Available?.number
        ?? null,
      spent:
        categoryPage.properties.Spent?.formula?.number
        ?? categoryPage.properties.Spent?.number
        ?? null,
    };

    const fundedEvents: TimelineEvent[] = (fundsData.results ?? []).map((page: NotionPage) => {
      const accountId = page.properties[PROP_ACCOUNTS]?.relation?.[0]?.id ?? null;
      const account = accountId ? accountLookup.get(normalizeId(accountId)) : null;
      const amount = page.properties.Planned?.number ?? 0;

      return {
        id: page.id,
        date: page.properties.Date?.date?.start ?? "",
        kind: "funded",
        amount,
        direction: "in",
        title: `Funded from ${account?.name ?? "account"}`,
        subtitle: page.properties["Assignment Type"]?.select?.name ?? undefined,
        accountId,
        accountName: account?.name ?? null,
        assignmentType: page.properties["Assignment Type"]?.select?.name ?? null,
        sourceDb: "funds",
      };
    });

    const transferInEvents: TimelineEvent[] = (transferInData.results ?? []).map((page: NotionPage) => {
      const relatedCategoryId = page.properties[PROP_BUDGET_OUT]?.relation?.[0]?.id ?? null;
      const relatedCategory = relatedCategoryId ? categoryLookup.get(normalizeId(relatedCategoryId)) : null;
      const accountId = page.properties[PROP_ACCOUNT_IN]?.relation?.[0]?.id ?? null;
      const account = accountId ? accountLookup.get(normalizeId(accountId)) : null;

      return {
        id: page.id,
        date: page.properties.Date?.date?.start ?? "",
        kind: "moved_in",
        amount: page.properties.Amount?.number ?? 0,
        direction: "in",
        title: `Moved in from ${relatedCategory?.name ?? "another budget"}`,
        subtitle: account?.name ?? undefined,
        accountId,
        accountName: account?.name ?? null,
        relatedCategoryId,
        relatedCategoryName: relatedCategory?.name ?? null,
        sourceDb: "transactions",
      };
    });

    const transferOutEvents: TimelineEvent[] = (transferOutData.results ?? []).map((page: NotionPage) => {
      const relatedCategoryId = page.properties[PROP_BUDGET_IN]?.relation?.[0]?.id ?? null;
      const relatedCategory = relatedCategoryId ? categoryLookup.get(normalizeId(relatedCategoryId)) : null;
      const accountId = page.properties[PROP_ACCOUNT_OUT]?.relation?.[0]?.id ?? null;
      const account = accountId ? accountLookup.get(normalizeId(accountId)) : null;

      return {
        id: page.id,
        date: page.properties.Date?.date?.start ?? "",
        kind: "moved_out",
        amount: page.properties.Amount?.number ?? 0,
        direction: "out",
        title: `Moved to ${relatedCategory?.name ?? "another budget"}`,
        subtitle: account?.name ?? undefined,
        accountId,
        accountName: account?.name ?? null,
        relatedCategoryId,
        relatedCategoryName: relatedCategory?.name ?? null,
        sourceDb: "transactions",
      };
    });

    const expenseEvents: TimelineEvent[] = (expenseData.results ?? []).map((page: NotionPage) => {
      const accountId =
        page.properties.Account?.relation?.[0]?.id
        ?? page.properties["Actual Account"]?.relation?.[0]?.id
        ?? null;
      const account = accountId ? accountLookup.get(normalizeId(accountId)) : null;

      return {
        id: page.id,
        date: page.properties.Date?.date?.start ?? "",
        kind: "expense",
        amount: page.properties.Amount?.number ?? 0,
        direction: "out",
        title: page.properties.Name?.title?.[0]?.plain_text ?? "Expense",
        subtitle: account?.name ?? undefined,
        accountId,
        accountName: account?.name ?? null,
        sourceDb: "transactions",
      };
    });

    const timeline = [...fundedEvents, ...transferInEvents, ...transferOutEvents, ...expenseEvents]
      .sort((a, b) => {
        const dateDiff = (b.date || "").localeCompare(a.date || "");
        return dateDiff !== 0 ? dateDiff : a.title.localeCompare(b.title);
      })
      .slice(0, limit);

    const summary = {
      month,
      fundedTotal: fundedEvents.reduce((sum, item) => sum + item.amount, 0),
      movedInTotal: transferInEvents.reduce((sum, item) => sum + item.amount, 0),
      movedOutTotal: transferOutEvents.reduce((sum, item) => sum + item.amount, 0),
      spentTotal: expenseEvents.reduce((sum, item) => sum + item.amount, 0),
      netFlow:
        fundedEvents.reduce((sum, item) => sum + item.amount, 0)
        + transferInEvents.reduce((sum, item) => sum + item.amount, 0)
        - transferOutEvents.reduce((sum, item) => sum + item.amount, 0)
        - expenseEvents.reduce((sum, item) => sum + item.amount, 0),
    };

    return NextResponse.json({
      category: summaryCategory,
      summary,
      timeline,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load category activity" }, { status: 500 });
  }
}
