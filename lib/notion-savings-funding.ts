import { withSavingsFundingLock } from "./savings-funding-lock";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { mapCategoryPage } from "./notion-category-record";
import { isSavingsCategory } from "../app/components/wallet-utils";
import { isCalendarDate } from "./bills";
import { FUNDING_AMOUNT, FUNDING_HOLDING, FUNDING_OPERATION, SAVINGS_TARGET, normalizeId, readText, richText, type SavingsFundingTarget } from "./savings-funding";

const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";
const TX_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const CAT_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACC_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const fail = (message: string, status = 409): never => { throw Object.assign(new Error(message), { status }); };
type Draft = { operationId: string; categoryId: string; accountId: string; amount: number; date: string; target: SavingsFundingTarget };
const locks = new Map<string, Promise<unknown>>();

async function ensureSchema(token: string, db: string, fund: boolean) {
  const { data } = await notionFetchJson<any>(token, `/databases/${db}`);
  const expected: Record<string, string> = { [FUNDING_OPERATION]: "rich_text", [SAVINGS_TARGET]: "select", ...(fund ? { [FUNDING_AMOUNT]: "number", [FUNDING_HOLDING]: "rich_text" } : {}) };
  const properties: Record<string, any> = {};
  for (const [name, type] of Object.entries(expected)) {
    if (data.properties?.[name] && data.properties[name].type !== type) fail(`Notion property ${name} must have type ${type}.`);
    if (!data.properties?.[name]) properties[name] = { [type]: {} };
  }
  if (Object.keys(properties).length) await notionFetchJson(token, `/databases/${db}`, { method: "PATCH", body: { properties } });
}
async function pageIn(token: string, id: string, db: string) {
  const { data } = await notionFetchJson<any>(token, `/pages/${id}`);
  if (normalizeId(data.parent?.database_id) !== normalizeId(db) || data.archived || data.in_trash) fail("The selected record is unavailable.");
  return data;
}
function assertDraft(input: Draft) {
  if (!/^[a-f0-9-]{36}$/i.test(input.operationId ?? "") || !/^[a-f0-9-]{32,36}$/i.test(input.categoryId ?? "") || !/^[a-f0-9-]{32,36}$/i.test(input.accountId ?? "") ||
    !Number.isFinite(input.amount) || input.amount <= 0 || Math.round(input.amount * 100) / 100 !== input.amount || !isCalendarDate(input.date) || !["separate", "shared"].includes(input.target)) fail("Choose an account, target, valid date, and positive amount with at most two decimals.", 400);
}
/** One durable funding operation links the transfer and assignment. Retrying
 * resumes it; no transfer is repeated after a rejected final assignment. */
export async function fundSavings(token: string, draft: Draft) {
  assertDraft(draft);
  const key = `${token}:${draft.operationId}`;
  const existing = locks.get(key);
  if (existing) { await existing.catch(() => {}); return fundSavings(token, draft); }
  const request = withSavingsFundingLock(key, () => performFunding(token, draft));
  locks.set(key, request);
  try { return await request; } finally { if (locks.get(key) === request) locks.delete(key); }
}
async function performFunding(token: string, draft: Draft) {
  let pending = false;
  try {
    const category = mapCategoryPage(await pageIn(token, draft.categoryId, CAT_DB));
    if (!isSavingsCategory(category) || !category.defaultAccount || category.archived) fail("Choose an active savings category with a holding account.");
    const holding = await pageIn(token, category.defaultAccount, ACC_DB);
    const holdingTitle: any = Object.values(holding.properties ?? {}).find((property: any) => property.type === "title");
    const holdingLabel = (holdingTitle?.title ?? []).map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");
    if (draft.target === "shared" && !/joined|joint/i.test(holdingLabel)) fail("Shared contributions require savings held in Joined Account.");
    await ensureSchema(token, FUNDS_DB, true);
    const filter = { property: FUNDING_OPERATION, rich_text: { equals: draft.operationId } };
    const funds = await queryDatabaseAll(token, FUNDS_DB, { filter });
    if (funds.length > 1) fail("Duplicate funding operations found. Review this operation before retrying.");
    let fund = funds[0];
    if (fund) {
      pending = true;
      const p = fund.properties;
      if (p[FUNDING_AMOUNT]?.number !== draft.amount || p[SAVINGS_TARGET]?.select?.name !== draft.target ||
        normalizeId(p.Category?.relation?.[0]?.id) !== normalizeId(draft.categoryId) || normalizeId(p["🏦 Accounts"]?.relation?.[0]?.id) !== normalizeId(draft.accountId) ||
        normalizeId(readText(p[FUNDING_HOLDING])) !== normalizeId(category.defaultAccount) || p.Date?.date?.start !== draft.date) fail("Retry the original savings funding with its original account, amount, date, and target.");
      if (p.Planned?.number === draft.amount) return { id: fund.id, resumed: true };
      if (p.Planned?.number !== 0) fail("This savings funding was changed. Review it before retrying.");
    } else {
      const source = await pageIn(token, draft.accountId, ACC_DB);
      const balance: any = Object.entries(source.properties ?? {}).find(([name]) => /^(current balance|balance|ledger balance)$/i.test(name))?.[1];
      const available = balance?.formula?.number ?? balance?.rollup?.number ?? balance?.number;
      if (typeof available !== "number" || !Number.isFinite(available) || available < draft.amount) fail("The funding account does not have enough cash for this deposit.");
      if (draft.target === "separate" && normalizeId(draft.accountId) === normalizeId(category.defaultAccount)) {
        const readyProp: any = Object.entries(source.properties ?? {}).find(([name]) => /^(ready to assign|available to assign)$/i.test(name))?.[1];
        const ready = readyProp?.formula?.number ?? readyProp?.rollup?.number ?? readyProp?.number;
        if (typeof ready !== "number" || ready < draft.amount) fail("Use a personal funding account or unassigned joint money for separate savings.");
      }
      pending = true;
      const { data } = await notionFetchJson<any>(token, "/pages", { method: "POST", body: {
        parent: { database_id: FUNDS_DB }, properties: {
          Name: { title: [{ text: { content: `To ${category.name}` } }] }, Planned: { number: 0 },
          Category: { relation: [{ id: draft.categoryId }] }, "🏦 Accounts": { relation: [{ id: draft.accountId }] },
          Date: { date: { start: draft.date } }, "Assignment Type": { select: { name: "Additional" } },
          [FUNDING_OPERATION]: richText(draft.operationId), [FUNDING_AMOUNT]: { number: draft.amount },
          [FUNDING_HOLDING]: richText(category.defaultAccount), [SAVINGS_TARGET]: { select: { name: draft.target } },
        },
      } });
      fund = data; pending = true;
    }
    if (normalizeId(draft.accountId) !== normalizeId(category.defaultAccount)) {
      await ensureSchema(token, TX_DB, false);
      const transfers = await queryDatabaseAll(token, TX_DB, { filter });
      if (transfers.length > 1) fail("Duplicate savings transfers found. Review this operation before retrying.");
      if (!transfers.length) {
        await notionFetchJson(token, "/pages", { method: "POST", body: {
          parent: { database_id: TX_DB }, properties: {
            Name: { title: [{ text: { content: `To ${category.name}` } }] }, Amount: { number: draft.amount },
            Date: { date: { start: draft.date } }, Type: { select: { name: "Transfer" } },
            Category: { relation: [{ id: draft.categoryId }] },
            "🏦 account ( out )": { relation: [{ id: draft.accountId }] }, "🏦 account ( in )": { relation: [{ id: category.defaultAccount }] },
            [FUNDING_OPERATION]: richText(draft.operationId), [SAVINGS_TARGET]: { select: { name: draft.target } },
          },
        } });
      } else {
        const p = transfers[0].properties;
        if (p.Type?.select?.name !== "Transfer" || p.Amount?.number !== draft.amount || p[SAVINGS_TARGET]?.select?.name !== draft.target ||
          normalizeId(p["🏦 account ( out )"]?.relation?.[0]?.id) !== normalizeId(draft.accountId) || normalizeId(p["🏦 account ( in )"]?.relation?.[0]?.id) !== normalizeId(category.defaultAccount)) fail("The linked transfer changed. Review it before retrying.");
      }
    }
    await notionFetchJson(token, `/pages/${fund.id}`, { method: "PATCH", body: { properties: { Planned: { number: draft.amount } } } });
    return { id: fund.id, resumed: false };
  } catch (error) { throw Object.assign(error instanceof Error ? error : new Error("Could not fund savings."), { pending }); }
}
