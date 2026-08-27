import { notionFetchJson } from "@/lib/notion-api";

const CATEGORIES_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";

export type ShortcutCategory = {
  id: string;
  name: string;
  icon: string | null;
};

export type ShortcutAccount = {
  id: string;
  name: string;
  icon: string | null;
  type: string | null;
};

export type ShortcutOptions = {
  categories: ShortcutCategory[];
  accounts: ShortcutAccount[];
};

type NotionProperty = { name: string; type: string };

const normalizePropertyName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeLookupValue = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

const findProperty = (
  properties: NotionProperty[],
  type: string,
  aliases: string[],
): string | undefined => {
  const candidates = properties.filter((property) => property.type === type);
  for (const alias of aliases) {
    const normalizedAlias = normalizePropertyName(alias);
    const exact = candidates.find(
      (property) => normalizePropertyName(property.name) === normalizedAlias,
    );
    if (exact) return exact.name;
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizePropertyName(alias);
    const contains = candidates.find((property) =>
      normalizePropertyName(property.name).includes(normalizedAlias),
    );
    if (contains) return contains.name;
  }
  if (candidates.length === 1) return candidates[0].name;
  return undefined;
};

const titleValue = (property: any): string =>
  property?.title?.[0]?.plain_text?.trim() ?? "";

async function queryAll(
  token: string,
  databaseId: string,
  body: Record<string, unknown>,
): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;

  do {
    const { data } = await notionFetchJson<any>(token, `/databases/${databaseId}/query`, {
      method: "POST",
      body: {
        ...body,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
      cache: "no-store",
    });
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

async function fetchCategories(token: string): Promise<ShortcutCategory[]> {
  const { data: database } = await notionFetchJson<any>(token, `/databases/${CATEGORIES_DB}`);
  const properties = Object.entries(database.properties ?? {}).map(([name, property]: [string, any]) => ({
    name,
    type: property.type,
  }));
  const titleKey = findProperty(properties, "title", ["Category", "Name", "Title"]);
  if (!titleKey) throw new Error("Categories database needs a title property");

  const filters: any[] = [];
  const archivedKey = findProperty(properties, "checkbox", ["Archived", "Archive"]);
  const snoozeKey = findProperty(properties, "checkbox", ["Snooze", "Hidden", "Frozen"]);
  if (archivedKey) filters.push({ property: archivedKey, checkbox: { equals: false } });
  if (snoozeKey) filters.push({ property: snoozeKey, checkbox: { equals: false } });

  const pages = await queryAll(token, CATEGORIES_DB, {
    ...(filters.length === 1 ? { filter: filters[0] } : {}),
    ...(filters.length > 1 ? { filter: { and: filters } } : {}),
    sorts: [{ property: titleKey, direction: "ascending" }],
  });

  return pages
    .map((page) => ({
      id: page.id,
      name: titleValue(page.properties?.[titleKey]),
      icon: page.icon?.type === "emoji" ? page.icon.emoji ?? null : null,
    }))
    .filter((category) => category.id && category.name);
}

async function fetchAccounts(token: string): Promise<ShortcutAccount[]> {
  const { data: database } = await notionFetchJson<any>(token, `/databases/${ACCOUNTS_DB}`);
  const properties = Object.entries(database.properties ?? {}).map(([name, property]: [string, any]) => ({
    name,
    type: property.type,
  }));
  const titleKey = findProperty(properties, "title", ["Name", "Account", "Title"]);
  if (!titleKey) throw new Error("Accounts database needs a title property");
  const typeKey = findProperty(properties, "select", ["Account Type", "Type"]);
  const disabledKey = findProperty(properties, "checkbox", ["Disabled", "Inactive", "Archived"]);

  const pages = await queryAll(token, ACCOUNTS_DB, {
    ...(disabledKey
      ? { filter: { property: disabledKey, checkbox: { equals: false } } }
      : {}),
    sorts: [{ property: titleKey, direction: "ascending" }],
  });

  return pages
    .map((page) => ({
      id: page.id,
      name: titleValue(page.properties?.[titleKey]),
      icon: page.icon?.type === "emoji" ? page.icon.emoji ?? null : null,
      type: page.properties?.[typeKey ?? ""]?.select?.name ?? null,
    }))
    .filter((account) => account.id && account.name);
}

export async function fetchShortcutOptions(): Promise<ShortcutOptions> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not configured");

  const [categories, accounts] = await Promise.all([
    fetchCategories(token),
    fetchAccounts(token),
  ]);

  return { categories, accounts };
}

export type ResolvedOption<T> =
  | { option: T }
  | { error: "missing" | "not_found" | "ambiguous" };

export function resolveOption<T extends { id: string; name: string }>(
  value: unknown,
  options: T[],
): ResolvedOption<T> {
  if (typeof value !== "string" || !value.trim()) return { error: "missing" };
  const input = value.trim();

  const byId = options.filter((option) => option.id === input);
  if (byId.length === 1) return { option: byId[0] };

  const normalized = normalizeLookupValue(input);
  const byName = options.filter(
    (option) => normalizeLookupValue(option.name) === normalized,
  );
  if (byName.length === 1) return { option: byName[0] };
  if (byName.length > 1) return { error: "ambiguous" };
  return { error: "not_found" };
}
