import { NextRequest, NextResponse } from "next/server";
import { accountOwnerScope, categoryOwnerPeople } from "../../../lib/category-owners";

const CATEGORIES_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const NOTION_VERSION = "2022-06-28";

type NotionProp = { name: string; type: string };

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const accountsDb = () => process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const sameDb = (a?: string, b?: string) => Boolean(a && b) && a!.replace(/-/g, "") === b!.replace(/-/g, "");

// Notion only accepts a single emoji as a page icon.
const isEmoji = (value: string) =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value);

/** Read the account's Notion owners; returns an error response instead when it can't. */
async function readAccountOwners(token: string, accountId: string): Promise<{ people: { id: string }[] } | NextResponse> {
  const accountRes = await fetch(`https://api.notion.com/v1/pages/${accountId}`, { headers: notionHeaders(token), cache: "no-store" });
  const account = await accountRes.json();
  if (!accountRes.ok) return NextResponse.json({ error: "Could not read account owners" }, { status: accountRes.status });
  if (!sameDb(account.parent?.database_id, accountsDb())) {
    return NextResponse.json({ error: "Choose an account from the accounts database" }, { status: 400 });
  }
  try { return { people: categoryOwnerPeople(account.properties, accountOwnerScope(account.properties)) }; }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
}

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

/** Find a property value by case-insensitive name match, trying formula/rollup/number types. */
const readNumericProp = (props: Record<string, any>, name: string): number | null => {
  const key = Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase());
  if (!key) return null;
  const p = props[key];
  return p?.formula?.number ?? p?.rollup?.number ?? p?.number ?? null;
};

const mapCategoryPage = (page: any) => {
  const props = page.properties ?? {};
  const isTeamFund = props["Team Fund"]?.formula?.boolean ?? false;
  const typeValues = props.Type?.multi_select?.map((t: any) => t.name) ?? [];
  return {
    id: page.id,
    name: props.Category?.title?.[0]?.plain_text ?? "Unnamed",
    icon: page.icon?.emoji ?? null,
    type: typeValues,
    owner:
      props.Owner?.select?.name ??
      props.Owner?.people?.[0]?.name ??
      null,
    defaultAccount: props.Default?.relation?.[0]?.id ?? null,
    available: readNumericProp(props, "Available"),
    planned: props.Planned?.number ?? null,
    lastMonthSpent: readNumericProp(props, "Last month spent"),
    isTeamFund,
    snoozed: props.Snooze?.checkbox ?? false,
    archived: props.Archived?.checkbox ?? false,
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
        filter: { and: filters },
        sorts: [{ property: "Category", direction: "ascending" }],
        page_size: 100,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    // Use the database query payload directly. Fetching every category page in
    // parallel exhausts Notion's request budget during initial app loading.
    const categories = (data.results ?? []).map(mapCategoryPage);

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
  const editing = ["name", "icon", "type", "accountId"].some(key => key in body);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (editing && (!name || !accountId || typeof body.icon !== "string" || typeof body.type !== "string")) {
    return NextResponse.json({ error: "Provide a name, icon, type and default account" }, { status: 400 });
  }
  if (editing && body.icon.trim() && !isEmoji(body.icon.trim())) return NextResponse.json({ error: "Icon must be a single emoji" }, { status: 400 });
  if (!editing && !Object.keys(properties).length) return NextResponse.json({ error: "No category updates provided" }, { status: 400 });

  try {
    if (editing) {
      const categoryRes = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: notionHeaders(token), cache: "no-store" });
      const category = await categoryRes.json();
      if (!categoryRes.ok) return NextResponse.json({ error: category.message || "Could not read category" }, { status: categoryRes.status });
      if (!sameDb(category.parent?.database_id, CATEGORIES_DB)) {
        return NextResponse.json({ error: "Choose a category from the categories database" }, { status: 400 });
      }
      const owners = await readAccountOwners(token, accountId);
      if (owners instanceof NextResponse) return owners;
      properties.Category = { title: [{ text: { content: name } }] };
      properties.Type = { multi_select: body.type.trim() ? [{ name: body.type.trim() }] : [] };
      properties.Default = { relation: [{ id: accountId }] };
      properties.Owner = { people: owners.people };
    }
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties, ...(editing ? { icon: body.icon.trim() ? { type: "emoji", emoji: body.icon.trim() } : null } : {}) }),
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
  const categoryType = typeof body?.type === "string" ? body.type.trim() : "";
  const accountId = typeof body?.accountId === "string" && body.accountId ? body.accountId : null;

  if (!name) return NextResponse.json({ error: "Missing category name" }, { status: 400 });
  if (icon && !isEmoji(icon)) return NextResponse.json({ error: "Icon must be a single emoji" }, { status: 400 });

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
    const ownerKey = props.find(p => p.type === "people" && norm(p.name) === "owner")?.name;
    const selectOwnerKey = props.find(p => p.type === "select" && ["owner", "scope", "person"].includes(norm(p.name)))?.name;
    const defaultKey = pickByTypeAndAliases(props, "relation", ["Default", "Default Account", "Account"]);
    const snoozeKey = pickByTypeAndAliases(props, "checkbox", ["Snooze", "Hidden", "Frozen"]);
    const archivedKey = pickByTypeAndAliases(props, "checkbox", ["Archived", "Archive"]);

    const properties: Record<string, unknown> = {
      [titleKey]: { title: [{ text: { content: name } }] },
    };

    if (typeKey && categoryType) {
      properties[typeKey] = { multi_select: [{ name: categoryType }] };
    }

    if (ownerKey) {
      if (!accountId) return NextResponse.json({ error: "Choose an account to assign category owners" }, { status: 400 });
      const owners = await readAccountOwners(token, accountId);
      if (owners instanceof NextResponse) return owners;
      properties[ownerKey] = { people: owners.people };
    } else if (selectOwnerKey) {
      properties[selectOwnerKey] = { select: { name: scope === "joint" ? "Joint" : scopeToOwner(scope) } };
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

    return NextResponse.json({ category: mapCategoryPage(data) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 500 });
  }
}
