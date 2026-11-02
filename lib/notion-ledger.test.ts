import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({ pages: [] as any[], queryFails: false, createFails: false }));
vi.mock("./notion-api", () => ({
  queryDatabaseAll: async (_: string, __: string, body: any) => {
    if (state.queryFails) throw new Error("Notion unavailable");
    return state.pages.filter(page => page.parent.database_id === __ && body.filter.and.every((filter: any) => {
      const p = page.properties[filter.property];
      return filter.select ? p.select.name === filter.select.equals : p.rich_text.map((t: any) => t.text.content).join("") === filter.rich_text.equals;
    }));
  },
  notionFetchJson: vi.fn(async (_: string, __: string, options: any) => {
    if (state.createFails) throw new Error("Unknown create outcome");
    expect(options.retries).toBe(0);
    const page = { id: String(state.pages.length + 1), properties: options.body.properties, parent: options.body.parent };
    state.pages.push(page); return { data: page, status: 200 };
  }),
}));
import { currentLedgerRecord, ledgerText, NotionLedger, withNotionWrite } from "./notion-ledger";
import { NotionBalanceCheckStore, NotionContributionStore, NotionOperations } from "./notion-finance-stores";
let ledger: NotionLedger;
beforeEach(() => { state.pages = []; state.queryFails = false; state.createFails = false; vi.stubEnv("NOTION_SINGLE_WRITER", "true"); vi.stubEnv("VERCEL", ""); ledger = new NotionLedger("test", randomUUID()); });
afterEach(() => vi.unstubAllEnvs());
it("chunks long JSON without losing transaction IDs or splitting surrogate pairs", () => {
  const value = JSON.stringify({ ids: Array.from({length: 1500}, () => randomUUID()), label: "💜".repeat(2000) });
  const chunks = ledgerText(value).rich_text;
  expect(chunks.every(chunk => chunk.text.content.length <= 1800)).toBe(true);
  expect(chunks.map(chunk => chunk.text.content).join("")).toBe(value);
});
it("preserves original contribution amounts and history across edits and rejects stale versions", async () => {
  const store = new NotionContributionStore(ledger);
  const shares = { anas: .65, salma: .35 };
  const first = await store.save("home", "2026-10", { anas: 100, salma: 50 }, shares, null);
  const next = await store.save("home", "2026-10", { anas: 120, salma: 60 }, shares, first!.version);
  expect(next?.original).toEqual({anas: 100, salma: 50});
  expect(next?.confirmedAt).toBe(first?.confirmedAt);
  expect(await store.save("home", "2026-10", {anas: 1, salma: 1}, shares, first!.version)).toBeNull();
  expect(await new NotionContributionStore(ledger).list("home")).toEqual([next]);
  expect(state.pages).toHaveLength(2);
  expect(await store.list("other-household")).toEqual([]);
});
it("one of two concurrent agreement edits wins on the single writer", async () => {
  const store = new NotionContributionStore(ledger);
  const results = await Promise.all([store.save("home", "2026-11", {anas:10,salma:5},{anas:.65,salma:.35},null),store.save("home", "2026-11", {anas:20,salma:10},{anas:.65,salma:.35},null)]);
  expect(results.filter(Boolean)).toHaveLength(1);
});
it("keeps recovered counts out of actual-funds estimates until replaced by a confirmed count", async () => {
  await ledger.append({scope:"home",kind:"balance-check",key:"account",version:"recovery",replaces:null,state:"review",payload:{actualBalance:494,source:"earlier user count; transaction cutoff unavailable"}});
  const store = new NotionBalanceCheckStore(ledger);
  expect(await store.list("home")).toEqual([]);
  expect(await store.recoveryPending("home")).toBe(true);
  expect(await store.reviewCounts("home")).toEqual([{accountId:"account", actualBalance:494, reportedDay:undefined}]);
  const check = {accountId:"account",version:"confirmed",actualBalance:500,ledgerBalance:600,checkedAt:new Date().toISOString(),checkedDay:"2026-10-31",knownTransactionIds:["id"]};
  expect(await store.save("home",check,null)).toBe(true);
  expect(await store.recoveryPending("home")).toBe(false);
  expect(await store.reviewCounts("home")).toEqual([]);
  expect(await store.list("home")).toEqual([check]);
  expect(await store.close("home","account","wrong")).toBe(false);
  expect(await store.close("home","account","confirmed")).toBe(true);
  expect(await store.list("home")).toEqual([]);
});
it("never substitutes cached records for a failed live Notion read", async () => {
  await ledger.append({scope:"home",kind:"agreement",key:"month",version:"v1",replaces:null,state:"active",payload:{targets:{anas:1,salma:1}}});
  state.queryFails=true;
  await expect(ledger.list("home","agreement")).rejects.toThrow("Notion unavailable");
});
it("rejects forks, cycles, missing parents and duplicate financial versions rather than choosing silently", () => {
  const row = (version:string,replaces:string|null) => ({id:version,scope:"h",kind:"agreement",key:"k",version,replaces,state:"active" as const,payload:{}});
  expect(()=>currentLedgerRecord([row("a",null),row("b","a"),row("c","a")])).toThrow("Conflicting");
  expect(()=>currentLedgerRecord([row("a","b"),row("b","a")])).toThrow();
  expect(()=>currentLedgerRecord([row("b","missing")])).toThrow("Incomplete");
  expect(()=>currentLedgerRecord([row("a",null),row("a",null)])).toThrow("Duplicate");
});
it("returns durable operation receipts without repeating actions and rejects changed inputs", async () => {
  const store = new NotionOperations(ledger), run = vi.fn(async()=>({id:"expense"}));
  const result = await store.once("home","one","expense",{amount:10},run);
  expect(await new NotionOperations(ledger).once("home","one","expense",{amount:10},run)).toEqual(result);
  await expect(store.once("home","one","expense",{amount:11},run)).rejects.toThrow("different inputs");
  expect(run).toHaveBeenCalledOnce();
});
it("does not repeat unknown write outcomes, including failed receipt saves", async () => {
  const store = new NotionOperations(ledger), run = vi.fn(async()=>{state.createFails=true; return {id:"committed"};});
  await expect(store.once("home","uncertain","expense",{},run)).rejects.toThrow();
  state.createFails=false;
  await expect(store.once("home","uncertain","expense",{},run)).rejects.toThrow("pending");
  expect(run).toHaveBeenCalledOnce();
});
it("blocks old queued actions whose PostgreSQL receipts cannot be checked", async () => {
  vi.stubEnv("NOTION_OPERATIONS_CUTOVER","2026-10-31T15:00:00Z");
  const run=vi.fn(async()=>({ok:true})), store=new NotionOperations(ledger);
  await expect(store.once("home","old","expense",{},run,"2026-10-30T00:00:00Z")).rejects.toThrow("predates");
  await expect(store.once("home","unknown","expense",{},run)).rejects.toThrow("predates");
  expect(run).not.toHaveBeenCalled();
  expect(await store.once("home","new","expense",{},run,"2026-10-31T16:00:00Z")).toEqual({ok:true});
});
it("supports nested financial guards but refuses an uncoordinated serverless writer", async () => {
  expect(await withNotionWrite("household-mutation",()=>withNotionWrite("household-mutation",async()=>42))).toBe(42);
  vi.stubEnv("VERCEL","1"); const write=vi.fn();
  await expect(withNotionWrite("test",write)).rejects.toThrow("single app server");
  expect(write).not.toHaveBeenCalled();
});

it("does not merge another Notion database's read-your-write cache", async () => {
  await ledger.append({scope:"home",kind:"test",key:"k",version:"v",replaces:null,state:"active",payload:{private:true}});
  const other = new NotionLedger("test",randomUUID());
  expect(await other.list("home","test")).toEqual([]);
});
it("keeps the operation cutover in Notion when environment configuration is absent", async () => {
  const { mirrorScope } = await import("./mirror/store");
  await ledger.append({scope:mirrorScope(process.env.NOTION_TOKEN??""),kind:"checkpoint",key:"postgres-cutover",version:"v",replaces:null,state:"active",payload:{cutover:"2026-10-31T15:00:00Z"}});
  const run=vi.fn(async()=>({ok:true}));
  await expect(new NotionOperations(ledger).once("native-v1","old","expense",{},run)).rejects.toThrow("predates");
  expect(run).not.toHaveBeenCalled();
});

it("does not interpret an unfinished recovery as an empty set of agreements", async () => {
  await ledger.append({scope:"home",kind:"checkpoint",key:"postgres-cutover",version:"v",replaces:null,state:"review",payload:{recordsReady:false}});
  await expect(new NotionContributionStore(ledger).list("home")).rejects.toThrow("remain unknown");
  await expect(new NotionBalanceCheckStore(ledger).list("home")).rejects.toThrow("remain unknown");
});
it("preserves plan-addition recovery markers across Notion agreement revisions", async () => {
  const store = new NotionContributionStore(ledger);
  const shares = { anas: .65, salma: .35 };
  const additions = { operation: { categoryId: "category", amount: 50, shares, state: "funding" as const } };
  const initial = await store.save("home", "2026-11", { anas: 100, salma: 50 }, shares, null, additions);
  const revised = await store.save("home", "2026-11", { anas: 110, salma: 60 }, shares, initial!.version);
  expect(revised?.planAdditions).toEqual(additions);
  expect(revised?.original).toEqual({ anas: 100, salma: 50 });
});
