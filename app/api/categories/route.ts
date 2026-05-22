import { NextRequest, NextResponse } from "next/server";

const CATEGORIES_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const NOTION_VERSION = "2022-06-28";

type NotionProp = { name: string; type: string };

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByTypeAndAliases = (props: NotionProp[], type: string, aliases: string[]) => {
  const sameType = props.filter((prop) => prop.type === type);
  for (const alias of aliases) {
    const found = sameType.find((prop) => norm(prop.name) === norm(alias));
    if (found) return found.name;
  }
  return sameType[0]?.name;
};

const normalizeScope = (value: unknown) => {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "joint" || raw === "household" || raw === "team") return "joint";
  if (raw === "salma" || raw === "wife") return "salma";
  if (raw === "anas" || raw === "husband") return "anas";
  return "joint";
};

const scopeToOwner = (scope: string) => {
  if (scope === "salma") return "Salma";
  if (scope === "anas") return "Anas";
  return null;
};

const scopeToType = (scope: string, kind: string) => {
  if (kind === "savings") return "Savings";
  if (scope === "joint") return "Team";
  return "Budget";
};

const mapCategoryPage = (page: any) => {
  const isTeamFund = page.properties["Team Fund"]?.formula?.boolean ?? false;
  const typeValues = page.properties.Type?.multi_select?.map((t: any) => t.name) ?? [];
  return {
    id: page.id,
    name: page.properties.Category?.title?.[0]?.plain_text ?? "Unnamed",
    icon: page.icon?.emoji ?? null,
    type: typeValues,
    owner:
      page.properties.Owner?.select?.name ??
      page.properties.Owner?.people?.[0]?.name ??
      null,
    defaultAccount: page.properties.Default?.relation?.[0]?.id ?? null,
    available: page.properties["Available"]?.formula?.number ?? null,
    planned: page.properties.Planned?.number ?? null,
    lastMonthSpent: page.properties["Last month spent"]?.formula?.number ?? null,
    isTeamFund,
    snoozed: page.properties.Snooze?.checkbox ?? false,
    archived: page.properties.Archived?.checkbox ?? false,
  };
};

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const includeSnoozed = req.nextUrl.searchParams.get("includeSnoozed") === "true";

  try {
    const filters: any[] = [
      { property: "Archived", checkbox: { equals: false } },
    ];
    if (!includeSnoozed) {
      filters.unshift({ property: "Snooze", checkbox: { equals: false } });
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${CATEGORIES_DB}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      cache: "no-store",
      body: JSON.stringify({
        filter: {
          and: filters,
        },
        sorts: [{ property: "Category", direction: "ascending" }],
        page_size: 100,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const categories = data.results.map(mapCategoryPage);

    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing category id" }, { status: 400 });

  const properties: Record<string, unknown> = {};
  if (typeof body.snoozed === "boolean") properties.Snooze = { checkbox: body.snoozed };
  if (typeof body.archived === "boolean") properties.Archived = { checkbox: body.archived };
  if (!Object.keys(properties).length) return NextResponse.json({ error: "No category updates provided" }, { status: 400 });

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to update category" }, { status: res.status });
    return NextResponse.json({ category: mapCategoryPage(data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update category" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const scope = normalizeScope(body?.scope);
  const kind = body?.kind === "savings" ? "savings" : "budget";
  const accountId = typeof body?.accountId === "string" && body.accountId ? body.accountId : null;

  if (!name) return NextResponse.json({ error: "Missing category name" }, { status: 400 });

  try {
    const metaRes = await fetch(`https://api.notion.com/v1/databases/${CATEGORIES_DB}`, {
      method: "GET",
      headers: notionHeaders(token),
      cache: "no-store",
    });
    const meta = await metaRes.json();
    if (!metaRes.ok) return NextResponse.json({ error: meta.message || "Failed to read category schema" }, { status: metaRes.status });

    const props = Object.entries(meta.properties ?? {}).map(([propName, prop]: [string, any]) => ({
      name: propName,
      type: prop.type,
    }));

    const titleKey = pickByTypeAndAliases(props, "title", ["Category", "Name", "Title"]);
    if (!titleKey) return NextResponse.json({ error: "Categories database needs a title property" }, { status: 400 });

    const typeKey = pickByTypeAndAliases(props, "multi_select", ["Type", "Types", "Category Type"]);
    const ownerKey = pickByTypeAndAliases(props, "select", ["Owner", "Scope", "Person"]);
    const defaultKey = pickByTypeAndAliases(props, "relation", ["Default", "Default Account", "Account"]);
    const snoozeKey = pickByTypeAndAliases(props, "checkbox", ["Snooze", "Hidden", "Frozen"]);
    const archivedKey = pickByTypeAndAliases(props, "checkbox", ["Archived", "Archive"]);

    const properties: Record<string, unknown> = {
      [titleKey]: { title: [{ text: { content: name } }] },
    };

    if (typeKey) {
      properties[typeKey] = { multi_select: [{ name: scopeToType(scope, kind) }] };
    }

    const owner = scopeToOwner(scope);
    if (ownerKey && owner) {
      properties[ownerKey] = { select: { name: owner } };
    }

    if (defaultKey && accountId) {
      properties[defaultKey] = { relation: [{ id: accountId }] };
    }

    if (snoozeKey) properties[snoozeKey] = { checkbox: false };
    if (archivedKey) properties[archivedKey] = { checkbox: false };

    const createRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: CATEGORIES_DB },
        icon: icon ? { type: "emoji", emoji: icon } : undefined,
        properties,
      }),
    });

    const data = await createRes.json();
    if (!createRes.ok) return NextResponse.json({ error: data.message || "Failed to create category", full: data }, { status: createRes.status });

    return NextResponse.json({
      category: {
        id: data.id,
        name,
        icon: data.icon?.emoji ?? (icon || null),
        type: typeKey ? [scopeToType(scope, kind)] : [],
        owner,
        defaultAccount: accountId,
        available: null,
        planned: null,
        lastMonthSpent: null,
        isTeamFund: scope === "joint",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 500 });
  }
}
