import { withSavingsFundingLock } from "./savings-funding-lock";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { FUNDING_AMOUNT, FUNDING_HOLDING, FUNDING_OPERATION, SAVINGS_TARGET, SAVINGS_UNDONE, normalizeId, readAccountBalance, readText } from "./savings-funding";

const FUNDS_DB = process.env.NOTION_FUNDS_DB ?? "1936a2be89228058990dc549172f1d45";
const TX_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const CAT_DB = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const ACC_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";
const fail = (message: string, status = 409): never => { throw Object.assign(new Error(message), { status }); };
async function pageIn(token: string, id: string, db: string) {
  const { data } = await notionFetchJson<any>(token, `/pages/${id}`);
  if (normalizeId(data.parent?.database_id) !== normalizeId(db) || data.archived || data.in_trash) fail("A record needed to undo this deposit is unavailable.");
  return data;
}

/** Keep the zero-valued assignment as a tombstone: late funding retries must
 * never recreate a deposit that was deliberately undone. The transfer is archived. */
export async function undoSavingsDeposit(token: string, operationId: string) {
  if (typeof operationId !== "string" || !/^[a-f0-9-]{36}$/i.test(operationId)) fail("Choose a linked savings deposit.", 400);
  return withSavingsFundingLock(`${token}:${operationId}`, async () => {
    const filter = { property: FUNDING_OPERATION, rich_text: { equals: operationId } };
    const funds = await queryDatabaseAll(token, FUNDS_DB, { filter });
    if (funds.length !== 1) fail("The linked savings assignment could not be uniquely identified.");
    const fund = funds[0], p = fund.properties ?? {};
    const amount = p[FUNDING_AMOUNT]?.number;
    const planned = p.Planned?.number;
    const undone = Boolean(p[SAVINGS_UNDONE]?.checkbox);
    const categoryId = p.Category?.relation?.[0]?.id;
    const sourceId = p["🏦 Accounts"]?.relation?.[0]?.id;
    const holdingId = readText(p[FUNDING_HOLDING]);
    const target = p[SAVINGS_TARGET]?.select?.name;
    if (p.Category?.relation?.length !== 1 || p["🏦 Accounts"]?.relation?.length !== 1 || readText(p[FUNDING_OPERATION]) !== operationId || !categoryId || !sourceId || !holdingId || !["separate", "shared"].includes(target) ||
      typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || ![0, amount].includes(planned) || (undone && planned !== 0)) fail("This deposit was changed. Review its linked records before undoing it.");
    const transfers = await queryDatabaseAll(token, TX_DB, { filter });
    const moved = normalizeId(sourceId) !== normalizeId(holdingId);
    if (transfers.length > 1 || (!moved && transfers.length)) fail("Unexpected linked transfers found. Nothing was changed.");
    const transfer = transfers[0];
    if (moved && !transfer && !undone) fail("The linked transfer is missing. Review the deposit before undoing it.");
    if (transfer) {
      const t = transfer.properties ?? {};
      if (t.Category?.relation?.length !== 1 || t["🏦 account ( out )"]?.relation?.length !== 1 || t["🏦 account ( in )"]?.relation?.length !== 1 || t.Type?.select?.name !== "Transfer" || t.Amount?.number !== amount || t[SAVINGS_TARGET]?.select?.name !== target ||
        readText(t[FUNDING_OPERATION]) !== operationId || normalizeId(t.Category?.relation?.[0]?.id) !== normalizeId(categoryId) ||
        normalizeId(t["🏦 account ( out )"]?.relation?.[0]?.id) !== normalizeId(sourceId) || normalizeId(t["🏦 account ( in )"]?.relation?.[0]?.id) !== normalizeId(holdingId)) fail("The linked transfer was changed. Nothing was changed.");
      const holding = await pageIn(token, holdingId, ACC_DB);
      const cash = readAccountBalance(holding.properties);
      if (typeof cash !== "number" || !Number.isFinite(cash) || Math.round(cash * 100) < Math.round(amount * 100)) fail("The holding account does not have enough cash to undo this deposit.");
    }
    if (!undone) {
      const category = await pageIn(token, categoryId, CAT_DB);
      if (normalizeId(category.properties?.Default?.relation?.[0]?.id) !== normalizeId(holdingId)) fail("The category’s holding account changed. Review the deposit before undoing it.");
      const prop = category.properties?.Available;
      const available = prop?.formula?.number ?? prop?.rollup?.number ?? prop?.number;
      if (typeof available !== "number" || !Number.isFinite(available) || Math.round(available * 100) < Math.round(planned * 100)) fail("This deposit cannot be undone because its amount is no longer available in the savings category.");
      const { data: schema } = await notionFetchJson<any>(token, `/databases/${FUNDS_DB}`);
      const flag = schema.properties?.[SAVINGS_UNDONE];
      if (flag && flag.type !== "checkbox") fail(`${SAVINGS_UNDONE} must be a checkbox property in Notion.`);
      if (!flag) await notionFetchJson(token, `/databases/${FUNDS_DB}`, { method: "PATCH", body: { properties: { [SAVINGS_UNDONE]: { checkbox: {} } } } });
      await notionFetchJson(token, `/pages/${fund.id}`, { method: "PATCH", body: { properties: { Planned: { number: 0 }, [SAVINGS_UNDONE]: { checkbox: true } } } });
    }
    // This PATCH is idempotent. If it fails, the visible transfer can be retried;
    // the assignment tombstone lets that retry skip an already-applied reduction.
    if (transfer) await notionFetchJson(token, `/pages/${transfer.id}`, { method: "PATCH", body: { archived: true } });
    return { undone: true };
  });
}
