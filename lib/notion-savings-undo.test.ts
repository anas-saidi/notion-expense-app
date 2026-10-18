import { beforeEach, expect, it, vi } from "vitest";
import { undoSavingsDeposit } from "./notion-savings-undo";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { FUNDING_AMOUNT, FUNDING_HOLDING, FUNDING_OPERATION, SAVINGS_TARGET, SAVINGS_UNDONE, richText } from "./savings-funding";
vi.mock("./notion-api", () => ({ notionFetchJson: vi.fn(), queryDatabaseAll: vi.fn() }));
vi.mock("./savings-funding-lock", () => ({ withSavingsFundingLock: (_key: string, action: () => Promise<unknown>) => action() }));
const operation = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const categoryId = "cat", holdingId = "joint", sourceId = "wife";
let fund: any, transfer: any, available: number | null, cash: number | null, failArchive: boolean, duplicate: boolean;
beforeEach(() => {
  vi.resetAllMocks(); available = 3000; cash = 6000; failArchive = false; duplicate = false;
  fund = { id: "fund", properties: { Planned: { number: 3000 }, [FUNDING_AMOUNT]: { number: 3000 }, [FUNDING_HOLDING]: richText(holdingId),
    [FUNDING_OPERATION]: richText(operation), [SAVINGS_TARGET]: { select: { name: "separate" } }, Category: { relation: [{ id: categoryId }] }, "🏦 Accounts": { relation: [{ id: sourceId }] } } };
  transfer = { id: "transfer", properties: { Type: { select: { name: "Transfer" } }, Amount: { number: 3000 },
    [FUNDING_OPERATION]: richText(operation), [SAVINGS_TARGET]: { select: { name: "separate" } }, Category: { relation: [{ id: categoryId }] },
    "🏦 account ( out )": { relation: [{ id: sourceId }] }, "🏦 account ( in )": { relation: [{ id: holdingId }] } } };
  vi.mocked(queryDatabaseAll).mockImplementation(async (_token, database) => database.replaceAll("-", "").startsWith("1936") ? (duplicate ? [fund, fund] : [fund]) : transfer.archived ? [] : [transfer]);
  vi.mocked(notionFetchJson).mockImplementation(async (_token, path, options) => {
    if (path === "/pages/joint") return { status: 200, data: { parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: { Balance: { type: "relation", relation: [{ id: "balance-row" }] }, "Current Balance": { formula: { number: cash } } } } };
    if (path === "/pages/cat") return { status: 200, data: { parent: { database_id: "1926a2be-8922-8029-9b90-c7d8bb55fabd" }, properties: { Available: { formula: { number: available } }, Default: { relation: [{ id: holdingId }] } } } };
    if (path.startsWith("/databases/")) return { status: 200, data: { properties: {} } };
    if (path === "/pages/fund") { fund.properties = { ...fund.properties, ...(options?.body as any).properties }; return { status: 200, data: fund }; }
    if (path === "/pages/transfer") { if (failArchive) throw new Error("Notion unavailable"); transfer.archived = true; return { status: 200, data: transfer }; }
    throw new Error(`Unexpected path ${path}`);
  });
});
it("removes the assignment and transfer together and retains a tombstone", async () => {
  await expect(undoSavingsDeposit("token", operation)).resolves.toEqual({ undone: true });
  expect(fund.properties.Planned.number).toBe(0); expect(fund.properties[SAVINGS_UNDONE].checkbox).toBe(true); expect(transfer.archived).toBe(true);
});
it("refuses undo if savings have been spent or moved out", async () => {
  available = 2999;
  await expect(undoSavingsDeposit("token", operation)).rejects.toMatchObject({ status: 409 });
  expect(fund.properties.Planned.number).toBe(3000); expect(transfer.archived).toBeUndefined();
});
it("refuses refunding cash the holding account cannot cover", async () => {
  cash = 2999;
  await expect(undoSavingsDeposit("token", operation)).rejects.toThrow("enough cash");
  expect(fund.properties.Planned.number).toBe(3000);
});
it("fails closed on unknown availability", async () => {
  available = null;
  await expect(undoSavingsDeposit("token", operation)).rejects.toMatchObject({ status: 409 });
  expect(fund.properties[SAVINGS_UNDONE]).toBeUndefined();
});
it("resumes a failed transfer archive without checking or removing the assignment twice", async () => {
  failArchive = true;
  await expect(undoSavingsDeposit("token", operation)).rejects.toThrow("Notion unavailable");
  expect(fund.properties.Planned.number).toBe(0);
  available = 0; failArchive = false;
  await undoSavingsDeposit("token", operation);
  await undoSavingsDeposit("token", operation);
  expect(transfer.archived).toBe(true);
  expect(vi.mocked(notionFetchJson).mock.calls.filter(([, path]) => path === "/pages/fund")).toHaveLength(1);
});
it("rejects changed linked transfer details without changing either record", async () => {
  transfer.properties.Amount.number = 3001;
  await expect(undoSavingsDeposit("token", operation)).rejects.toThrow("transfer was changed");
  expect(fund.properties.Planned.number).toBe(3000);
});
it("refuses ambiguous operations", async () => {
  duplicate = true;
  await expect(undoSavingsDeposit("token", operation)).rejects.toThrow("uniquely identified");
});
it("can undo a same-account assignment without creating a transfer", async () => {
  fund.properties["🏦 Accounts"].relation[0].id = holdingId;
  transfer.archived = true;
  await undoSavingsDeposit("token", operation);
  expect(fund.properties.Planned.number).toBe(0);
  expect(vi.mocked(notionFetchJson).mock.calls.some(([, path]) => path === "/pages/transfer")).toBe(false);
});
it("rejects invalid operation IDs before reading any data", async () => {
  await expect(undoSavingsDeposit("token", "anything")).rejects.toMatchObject({ status: 400 });
  expect(queryDatabaseAll).not.toHaveBeenCalled();
});
