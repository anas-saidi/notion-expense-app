import { notionFetchJson } from "./notion-api";
import { normalizeId, readAccountBalance } from "./savings-funding";

/** A legacy transfer has no linked assignment to infer or delete. Validate its
 * receiving side before removing only that transfer from the ledger. */
export async function assertTransferCanBeDeleted(token: string, page: any) {
  if (page.archived || page.in_trash) return;
  const properties = page.properties ?? {};
  const amount = properties.Amount?.number;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("This transfer’s amount could not be verified."), { status: 409 });
  const destinations = [
    { id: properties["🏦 account ( in )"]?.relation?.[0]?.id, db: process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b", account: true },
    { id: properties["💰 budget (in)"]?.relation?.[0]?.id, db: process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd", account: false },
  ].filter(destination => destination.id);
  if (!destinations.length) throw Object.assign(new Error("This transfer’s destination could not be verified."), { status: 409 });
  for (const destination of destinations) {
    const { data } = await notionFetchJson<any>(token, `/pages/${destination.id}`);
    if (normalizeId(data.parent?.database_id) !== normalizeId(destination.db) || data.archived || data.in_trash) throw Object.assign(new Error("The receiving account or category is unavailable."), { status: 409 });
    const property = data.properties?.Available;
    const available = destination.account ? readAccountBalance(data.properties) : property?.formula?.number ?? property?.rollup?.number ?? property?.number;
    if (typeof available !== "number" || !Number.isFinite(available) || Math.round(available * 100) < Math.round(amount * 100)) throw Object.assign(new Error("The receiving account or category no longer has enough money to delete this transfer."), { status: 409 });
  }
}
