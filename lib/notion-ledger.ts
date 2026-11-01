import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";

export type LedgerState = "active" | "closed" | "pending" | "completed" | "review";
export type LedgerRecord<T = any> = { id: string; scope: string; kind: string; key: string; version: string; replaces: string | null; state: LedgerState; payload: T };
const shared = globalThis as typeof globalThis & { financeNotionWrites?: Map<string, Promise<unknown>>; financeNotionWritten?: Map<string, LedgerRecord>; financeNotionWriteContext?: AsyncLocalStorage<Set<string>> };
const heldWrites = shared.financeNotionWriteContext ??= new AsyncLocalStorage<Set<string>>();
const queues = shared.financeNotionWrites ??= new Map();
const written = shared.financeNotionWritten ??= new Map();
export const notionLedgerConfigured = () => !!process.env.NOTION_FINANCE_RECORDS_DB;
export function assertNotionSingleWriter() {
  if (process.env.VERCEL || process.env.NOTION_SINGLE_WRITER !== "true") throw Object.assign(new Error("Notion financial writes require the configured single app server. Nothing was written."), { status: 503 });
}
/** Notion has no atomic CAS/locks. Never pretend a local queue coordinates serverless instances. */
export async function withNotionWrite<T>(key: string, action: () => Promise<T>): Promise<T> {
  assertNotionSingleWriter();
  if (heldWrites.getStore()?.has(key)) return action();
  const held = new Set(heldWrites.getStore()); held.add(key);
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(() => heldWrites.run(held, action));
  queues.set(key, task);
  try { return await task; } finally { if (queues.get(key) === task) queues.delete(key); }
}
export function ledgerText(value: string) {
  const chunks = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + 1800, value.length);
    if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--;
    chunks.push({ type: "text", text: { content: value.slice(start, end) } }); start = end;
  }
  if (chunks.length > 90) throw new Error("This financial record exceeds Notion's text limits. Nothing was written.");
  return { rich_text: chunks };
}
const text = (property: any) => (property?.rich_text ?? property?.title ?? []).map((entry: any) => entry.plain_text ?? entry.text?.content ?? "").join("");
export function decodeLedgerPage<T>(page: any): LedgerRecord<T> {
  const p = page.properties;
  const version = text(p.Version), payload = text(p.Payload);
  if (!["active", "closed", "pending", "completed", "review"].includes(p.State?.select?.name)) throw new Error("Unknown financial record state in Notion.");
  if (!version || !payload || !text(p.Scope) || !text(p.Key) || !p.Kind?.select?.name || !p.State?.select?.name) throw new Error("A Notion finance record is incomplete. Review Finance Records before continuing.");
  return { id: page.id, scope: text(p.Scope), kind: p.Kind.select.name, key: text(p.Key), version, replaces: text(p.Replaces) || null, state: p.State.select.name, payload: JSON.parse(payload) };
}
export function currentLedgerRecord<T>(rows: LedgerRecord<T>[]): LedgerRecord<T> | null {
  if (!rows.length) return null;
  const unique = new Map(rows.map(row => [row.version, row]));
  if (unique.size !== rows.length) throw Object.assign(new Error("Duplicate financial revisions need review in Notion."), { status: 409 });
  const replaced = new Set(rows.map(row => row.replaces).filter(Boolean));
  const heads = rows.filter(row => !replaced.has(row.version));
  if (heads.length !== 1) throw Object.assign(new Error("Conflicting financial revisions need review in Notion."), { status: 409 });
  // A single head is insufficient if a disconnected cycle also exists.
  const visited = new Set<string>(); let node: LedgerRecord<T> | undefined = heads[0];
  while (node) { if (visited.has(node.version)) throw new Error("Cyclic finance history needs review."); visited.add(node.version); if (node.replaces && !unique.has(node.replaces)) throw new Error("Incomplete finance history needs review in Notion."); node = node.replaces ? unique.get(node.replaces) : undefined; }
  if (visited.size !== rows.length) throw new Error("Incomplete finance history needs review in Notion.");
  return heads[0];
}
export class NotionLedger {
  constructor(private token = process.env.NOTION_TOKEN ?? "", readonly databaseId = process.env.NOTION_FINANCE_RECORDS_DB ?? "") {
    if (!token || !databaseId) throw Object.assign(new Error("Notion Finance Records is not configured."), { status: 503 });
  }
  private cacheKey(record: Pick<LedgerRecord, "scope" | "kind" | "key" | "version">) { return `${this.databaseId}:${record.scope}:${record.kind}:${record.key}:${record.version}`; }
  async list<T>(scope: string, kind: string, key?: string): Promise<LedgerRecord<T>[]> {
    const pages = await queryDatabaseAll<any>(this.token, this.databaseId, { filter: { and: [
      { property: "Scope", rich_text: { equals: scope } }, { property: "Kind", select: { equals: kind } },
      ...(key === undefined ? [] : [{ property: "Key", rich_text: { equals: key } }]),
    ] } });
    const rows = pages.map(decodeLedgerPage<T>);
    const ids = new Set(rows.map(row => row.version));
    // Read-your-write overlay only after a successful live read, never an outage fallback.
    for (const [cacheKey, row] of written) if (cacheKey.startsWith(`${this.databaseId}:`) && row.scope === scope && row.kind === kind && (key === undefined || row.key === key) && !ids.has(row.version)) rows.push(row);
    return rows;
  }
  async current<T>(scope: string, kind: string, key: string) { return currentLedgerRecord(await this.list<T>(scope, kind, key)); }
  async append<T>(record: Omit<LedgerRecord<T>, "id">): Promise<LedgerRecord<T>> {
    const projections: Record<string, unknown> = {};
    const payload = record.payload as any;
    if (record.kind === "agreement") { projections["Anas agreed"] = { number: payload.targets.anas }; projections["Salma agreed"] = { number: payload.targets.salma }; }
    if (record.kind === "balance-check" && typeof payload.actualBalance === "number") projections["Actual balance"] = { number: payload.actualBalance };
    const { data } = await notionFetchJson<any>(this.token, "/pages", { method: "POST", retries: 0, body: { parent: { database_id: this.databaseId }, properties: {
      Name: { title: [{ text: { content: `${record.kind}: ${record.key}` } }] }, Scope: ledgerText(record.scope), Kind: { select: { name: record.kind } }, Key: ledgerText(record.key),
      Version: ledgerText(record.version), Replaces: ledgerText(record.replaces ?? ""), State: { select: { name: record.state } }, Payload: ledgerText(JSON.stringify(record.payload)), ...projections,
    } } });
    if (!data.id) throw new Error("Notion did not confirm the record. Review Finance Records before retrying.");
    const result = { ...record, id: data.id };
    if (written.size >= 1024) written.delete(written.keys().next().value!);
    written.set(this.cacheKey(result), result);
    return result;
  }
  async revise<T>(scope: string, kind: string, key: string, expected: string | null, payload: T, state: LedgerState = "active", version: string = randomUUID()): Promise<LedgerRecord<T> | null> {
    return withNotionWrite("household-mutation", async () => {
      const current = await this.current<T>(scope, kind, key);
      if ((current?.version ?? null) !== expected) return null;
      const created = await this.append({ scope, kind, key, version, replaces: expected, payload, state });
      const verified = await this.current<T>(scope, kind, key);
      if (verified?.version !== created.version) throw Object.assign(new Error("This record changed on another device. Review it before continuing."), { status: 409 });
      return created;
    });
  }
}
