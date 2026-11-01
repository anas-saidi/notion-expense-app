import { waitUntil } from "@vercel/functions";
import { notionOnlyMode } from "./database-mode";
import { mirrorReadContext } from "./mirror/context";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { PROP_INCOME_BASELINE, PROP_INCOME_UNASSIGNED, remainingUnassignedIncome } from "./joint-income";

const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be-8922-8058-990d-c549172f1d45";
const sameId = (a: string, b: string) => a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();

export async function jointAssignedTotal(token: string, accountId: string): Promise<number> {
  const funds = await queryDatabaseAll(token, FUNDS_DB, { filter: { property: "🏦 Accounts", relation: { contains: accountId } } });
  return funds.reduce((sum, page) => sum + (page.properties?.Reverse?.checkbox ? -1 : 1) * (page.properties?.Planned?.number ?? 0), 0);
}

export async function incomeUseProperties(token: string, accountId: string, unassigned: boolean) {
  // Read live metadata: another instance may have added these properties already.
  const { data: schema } = await notionFetchJson<any>(token, `/databases/${TRANSACTIONS_DB}`);
  const properties: Record<string, unknown> = {};
  for (const [name, type] of [[PROP_INCOME_UNASSIGNED, "checkbox"], [PROP_INCOME_BASELINE, "number"]]) {
    const existing = schema.properties?.[name];
    if (existing && existing.type !== type) throw new Error(`${name} must be a ${type} property in Notion.`);
    if (!existing) properties[name] = { [type]: {} };
  }
  if (Object.keys(properties).length) {
    await notionFetchJson(token, `/databases/${TRANSACTIONS_DB}`, { method: "PATCH", body: { properties } });
  }
  return {
    [PROP_INCOME_UNASSIGNED]: { checkbox: unassigned },
    [PROP_INCOME_BASELINE]: { number: unassigned ? await jointAssignedTotal(token, accountId) : null },
  };
}

// The reserve needs every Funds entry ever linked to the joint account (~8s live). In
// Notion-only mode there's no snapshot to read it from and no saves can happen, so display
// reads serve the last value and refresh it in the background.
// ponytail: per-instance memory; an edit made directly in Notion shows one refresh late. Unused once the shared database is back.
const RESERVE_FRESH_MS = 30_000;
const reserveCache = new Map<string, { value: number; at: number; refreshing?: Promise<number> }>();

export async function jointFreeIncomeReserve(token: string, accountId: string): Promise<number> {
  if (!notionOnlyMode() || !mirrorReadContext.getStore()?.enabled) return readJointFreeIncomeReserve(token, accountId);
  const cached = reserveCache.get(accountId);
  const refresh = () => {
    const refreshing = readJointFreeIncomeReserve(token, accountId);
    reserveCache.set(accountId, { value: cached?.value ?? 0, at: cached?.at ?? 0, refreshing });
    refreshing.then(
      value => reserveCache.set(accountId, { value, at: Date.now() }),
      () => cached ? reserveCache.set(accountId, cached) : reserveCache.delete(accountId),
    );
    return refreshing;
  };
  // No value yet: wait for the read already in flight (or start one) rather than serve a placeholder.
  if (!cached?.at) return cached?.refreshing ?? refresh();
  if (Date.now() - cached.at > RESERVE_FRESH_MS && !cached.refreshing) waitUntil(refresh().catch(() => undefined));
  return cached.value;
}

async function readJointFreeIncomeReserve(token: string, accountId: string): Promise<number> {
  const pages = await queryDatabaseAll(token, TRANSACTIONS_DB, { filter: { and: [
    { property: "Type", select: { equals: "Income" } },
    { property: "Account", relation: { contains: accountId } },
  ] } });
  const incomes = pages.filter(page => page.properties?.[PROP_INCOME_UNASSIGNED]?.checkbox &&
    sameId(page.properties?.Account?.relation?.[0]?.id ?? "", accountId));
  if (!incomes.length) return 0;
  const assigned = await jointAssignedTotal(token, accountId);
  return remainingUnassignedIncome(incomes.map(page => {
    const baseline = page.properties?.[PROP_INCOME_BASELINE]?.number;
    if (typeof baseline !== "number") throw new Error("Unassigned income is missing its allocation baseline. Review this income in Notion.");
    return { id: page.id, createdAt: page.created_time ?? page.properties?.Date?.date?.start ?? "", amount: page.properties?.Amount?.number ?? 0, baseline };
  }), assigned);
}

export async function assertJointIncomeAccount(token: string, accountId: string) {
  const { data: account } = await notionFetchJson<any>(token, `/pages/${accountId}`);
  const accountsDb = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
  if (!sameId(account.parent?.database_id ?? "", accountsDb) || account.archived) throw new Error("Account does not belong to this app.");
  const title: any = Object.values(account.properties ?? {}).find((property: any) => property.type === "title");
  const label = (title?.title ?? []).map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");
  const { isJointIncomeAccount } = await import("./joint-income");
  if (!isJointIncomeAccount(label)) throw new Error("Unassigned income is only available for the joint spending account.");
}
