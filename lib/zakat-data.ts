import { NotionLedger, notionLedgerConfigured } from "./notion-ledger";
import { mirrorScope } from "./mirror/store";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { closeOnOrBefore, fetchYahooCloses, NISAB_SILVER_GRAMS, nisabMad } from "./silver-nisab";
import { dailyWealth, zakatSchedule, type LedgerAccount, type ZakatPayment, type ZakatSchedule } from "./zakat";

const TRANSACTIONS_DB = () => process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const RECONCILIATIONS_DB = () => process.env.NOTION_RECONCILIATIONS_DB ?? "30c6a2be-8922-80b5-b9d7-db4e707b2276";
const KIND = "zakat-setup";
const KEY = "owner";

export type ZakatSetupPayload = {
  standard: "silver";
  /** First day of the current chain of hawls, verified from records older than the app. */
  hawlStart: string;
  /** First day the app's ledger covers; wealth before it was checked when hawlStart was set. */
  ledgerStart: string;
  /** Accounts whose money is the owner's: zakat counts their total. */
  accountIds: string[];
  /** Expenses on these accounts whose name contains this word count as zakat paid. */
  paymentKeyword: string;
  /** "Record payment" opens an expense with this category and account. */
  paymentCategoryId: string;
  paymentAccountId: string;
  note?: string;
};

/** Verified on 2026-11-17 from the 2024 Notion exports and the app ledger (see the zakat memory). */
export const DEFAULT_ZAKAT_SETUP: ZakatSetupPayload = {
  standard: "silver",
  hawlStart: "2024-07-28",
  ledgerStart: "2025-01-31",
  accountIds: ["1936a2be-8922-80d9-8c4d-f1047b5abac0", "2be6a2be-8922-80a7-9ed2-c80775651460", "1936a2be-8922-80cc-9338-c4a7a1628120"],
  paymentKeyword: "zakat",
  paymentCategoryId: "3736a2be-8922-8085-8ce2-ea6c04442008", // Sadaqah (personal, Hubby), as on the Jul 1, 2026 payment
  paymentAccountId: "1936a2be-8922-80d9-8c4d-f1047b5abac0",
  note: "Balance was 2,750 MAD on 2024-07-27, below that day's silver nisab (5,076 MAD); the hawl starts the next day.",
};

export type ZakatResponse = {
  setup: ZakatSetupPayload;
  setupSaved: { version: string } | null;
  today: string;
  schedule: ZakatSchedule;
  prices:
    | { source: "yahoo"; silverDate: string; rateDate: string; silverUsdPerOunce: number; usdToMad: number }
    | { source: "manual"; silverMadPerGram: number };
};

const ledger = () => new NotionLedger();
export async function readZakatSetup(token: string) {
  if (!notionLedgerConfigured()) return null;
  try {
    return await ledger().current<ZakatSetupPayload>(mirrorScope(token), KIND, KEY);
  } catch (error) {
    // Notion rejects a filter on a select option that doesn't exist yet; it's created by the first save.
    if (error instanceof Error && /select option "zakat-setup" not found/.test(error.message)) return null;
    throw error;
  }
}
export async function saveZakatSetup(token: string, payload: ZakatSetupPayload, expected: string | null) {
  return ledger().revise<ZakatSetupPayload>(mirrorScope(token), KIND, KEY, expected, payload);
}

async function relationIds(token: string, pageId: string, propertyId: string) {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const query: string = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : "";
    const { data } = await notionFetchJson<any>(token, `/pages/${pageId}/properties/${encodeURIComponent(propertyId)}${query}`);
    ids.push(...(data.results ?? []).map((r: any) => r.relation?.id).filter(Boolean));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return ids;
}

const dateOf = (p: any) => p?.date?.start?.slice(0, 10) ?? null;
const numberOf = (p: any) => (p?.type === "formula" ? p.formula?.number : p?.number) ?? 0;

/** Rebuilds each account from the same linked records its Current Balance formula adds up. Loans are left out on purpose. */
async function loadAccounts(token: string, accountIds: string[], ledgerStart: string, paymentKeyword: string) {
  const keyword = paymentKeyword.trim().toLowerCase() || "zakat";
  const [txPages, reconPages] = await Promise.all([queryDatabaseAll<any>(token, TRANSACTIONS_DB()), queryDatabaseAll<any>(token, RECONCILIATIONS_DB())]);
  const tx = new Map(txPages.map(p => [p.id, { type: p.properties?.Type?.select?.name ?? null, amount: p.properties?.Amount?.number ?? 0, date: dateOf(p.properties?.Date), name: p.properties?.Name?.title?.map((t: any) => t.plain_text).join("") ?? "" }]));
  const recon = new Map(reconPages.map(p => [p.id, { amount: numberOf(p.properties?.Amount), date: dateOf(p.properties?.["Reconciliation Date"]) }]));
  const payments: ZakatPayment[] = [];
  const accounts: LedgerAccount[] = [];
  for (const id of accountIds) {
    const { data: page } = await notionFetchJson<any>(token, `/pages/${id}`);
    const props = page.properties ?? {};
    const rel = (name: string) => (props[name]?.id ? relationIds(token, id, props[name].id) : Promise.resolve([] as string[]));
    const [txIds, outIds, inIds, reconIds] = await Promise.all([rel("Transactions"), rel("Transfers ( out ) "), rel("Transfers ( in ) "), rel("Reconciliations")]);
    const pick = (ids: string[]) => ids.map(i => tx.get(i)).filter((x): x is NonNullable<typeof x> => !!x);
    const own = pick(txIds);
    const moves = [...own, ...pick(outIds), ...pick(inIds)];
    const firstDated = moves.map(m => m.date).filter((d): d is string => !!d).sort()[0];
    accounts.push({
      startDate: firstDated && firstDated > ledgerStart ? firstDated : ledgerStart,
      startingAmount: props["Starting Amount"]?.number ?? 0,
      income: own.filter(m => m.type === "Income"),
      expenses: own.filter(m => m.type === "Expense"),
      transfersIn: pick(inIds),
      transfersOut: pick(outIds),
      reconciliations: reconIds.map(i => recon.get(i)).filter((x): x is NonNullable<typeof x> => !!x && !!x.date),
    });
    own.forEach(m => { if (m.type === "Expense" && m.date && m.name.toLowerCase().includes(keyword)) payments.push({ date: m.date, amount: m.amount }); });
  }
  return { accounts, payments };
}

/**
 * manualSilverMadPerGram is used only when the price service is down; it then applies to every date,
 * so past years are estimates and the response says so.
 */
export async function loadZakat(token: string, today: string, manualSilverMadPerGram?: number): Promise<ZakatResponse> {
  const saved = await readZakatSetup(token);
  const setup = { ...DEFAULT_ZAKAT_SETUP, ...saved?.payload };
  const priceFrom = setup.ledgerStart < setup.hawlStart ? setup.ledgerStart : setup.hawlStart;
  const pricesPromise = Promise.all([fetchYahooCloses("SI=F", priceFrom, today), fetchYahooCloses("MAD=X", priceFrom, today)])
    .catch(error => {
      if (manualSilverMadPerGram && (error as { code?: string }).code === "PRICE_UNAVAILABLE") return null;
      throw error;
    });
  const [{ accounts, payments }, market] = await Promise.all([loadAccounts(token, setup.accountIds, setup.ledgerStart, setup.paymentKeyword), pricesPromise]);
  const wealth = dailyWealth(accounts, setup.ledgerStart, today);
  const nisab = market
    ? (date: string) => {
      const price = closeOnOrBefore(market[0], date), rate = closeOnOrBefore(market[1], date);
      if (!price || !rate) throw Object.assign(new Error(`No silver price or exchange rate near ${date}.`), { status: 502, code: "PRICE_UNAVAILABLE" });
      return nisabMad(price.value, rate.value);
    }
    : () => NISAB_SILVER_GRAMS * manualSilverMadPerGram!;
  const schedule = zakatSchedule({ setup, today, wealth: d => wealth.get(d) ?? 0, nisab, payments });
  const base = { setup, setupSaved: saved ? { version: saved.version } : null, today, schedule };
  if (!market) return { ...base, prices: { source: "manual", silverMadPerGram: manualSilverMadPerGram! } };
  const price = closeOnOrBefore(market[0], today)!, rate = closeOnOrBefore(market[1], today)!;
  return { ...base, prices: { source: "yahoo", silverDate: price.date, rateDate: rate.date, silverUsdPerOunce: price.value, usdToMad: rate.value } };
}
