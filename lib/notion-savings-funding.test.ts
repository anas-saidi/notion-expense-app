import { beforeEach, describe, expect, it, vi } from "vitest";
import { fundSavings } from "./notion-savings-funding";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { FUNDING_AMOUNT, FUNDING_HOLDING, FUNDING_OPERATION, SAVINGS_TARGET, richText } from "./savings-funding";
vi.mock("./notion-api", () => ({ notionFetchJson: vi.fn(), queryDatabaseAll: vi.fn() }));
const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const sourceId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const jointId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const draft = { operationId: "dddddddd-dddd-dddd-dddd-dddddddddddd", categoryId, accountId: sourceId, amount: 3000, date: "2026-10-18", target: "separate" as const };
const category = { parent: { database_id: "1926a2be-8922-8029-9b90-c7d8bb55fabd" }, properties: { Category: { title: [{ plain_text: "Bedroom" }] }, Type: { multi_select: [{ name: "Saving" }] }, Default: { relation: [{ id: jointId }] } } };
const account = (name: string) => ({ parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: { Name: { type: "title", title: [{ plain_text: name }] }, "Current Balance": { formula: { number: 5000 } }, "Ready to Assign": { formula: { number: 5000 } } } });
let fund: any, transfer: any, rejectFinal: boolean;
beforeEach(() => {
  vi.resetAllMocks(); fund = null; transfer = null; rejectFinal = false;
  vi.mocked(queryDatabaseAll).mockImplementation(async (_token, database) => database.replaceAll("-", "").startsWith("1936") ? (fund ? [fund] : []) : (transfer ? [transfer] : []));
  vi.mocked(notionFetchJson).mockImplementation(async (_token, path, options) => {
    if (path === `/pages/${categoryId}`) return { status: 200, data: category };
    if (path === `/pages/${jointId}`) return { status: 200, data: account("Joined Account") };
    if (path === `/pages/${sourceId}`) return { status: 200, data: account("Wife Account") };
    if (path.startsWith("/databases/")) return { status: 200, data: { properties: {} } };
    const body = options?.body as any;
    if (path === "/pages") {
      const page = { id: body.parent.database_id.replaceAll("-", "").startsWith("1936") ? "fund" : "transfer", properties: body.properties };
      if (page.id === "fund") fund = page; else transfer = page;
      return { status: 200, data: page };
    }
    if (path === "/pages/fund") {
      if (rejectFinal) throw new Error("Temporarily unavailable");
      fund.properties = { ...fund.properties, ...body.properties };
      return { status: 200, data: fund };
    }
    throw new Error(`Unexpected path ${path}`);
  });
});
describe("linked savings funding", () => {
  it("records separate classification on both records and assigns only after the transfer", async () => {
    await fundSavings("token", draft);
    expect(fund.properties.Planned.number).toBe(3000);
    expect(fund.properties[SAVINGS_TARGET].select.name).toBe("separate");
    expect(transfer.properties[SAVINGS_TARGET].select.name).toBe("separate");
    expect(transfer.properties.Category.relation[0].id).toBe(categoryId);
    const writes = vi.mocked(notionFetchJson).mock.calls.filter(([, path]) => path === "/pages" || path === "/pages/fund");
    expect(writes.map(([, path]) => path)).toEqual(["/pages", "/pages", "/pages/fund"]);
  });
  it("resumes partial failure and repeated successful requests without moving money twice", async () => {
    rejectFinal = true;
    await expect(fundSavings("token", draft)).rejects.toMatchObject({ pending: true });
    expect(fund.properties.Planned.number).toBe(0);
    rejectFinal = false;
    await fundSavings("token", draft);
    await fundSavings("token", draft);
    expect(vi.mocked(notionFetchJson).mock.calls.filter(([, path]) => path === "/pages")).toHaveLength(2);
    expect(fund.properties.Planned.number).toBe(3000);
  });
  it("rejects changed retry details", async () => {
    await fundSavings("token", draft);
    await expect(fundSavings("token", { ...draft, amount: 2000 })).rejects.toMatchObject({ status: 409, pending: true });
  });
  it("persists shared contribution selection", async () => {
    await fundSavings("token", { ...draft, target: "shared" });
    expect(transfer.properties[SAVINGS_TARGET].select.name).toBe("shared");
  });
  it("rejects invalid amounts before creating anything", async () => {
    await expect(fundSavings("token", { ...draft, amount: 3000.001 })).rejects.toMatchObject({ status: 400 });
    expect(notionFetchJson).not.toHaveBeenCalled();
  });
  it("does not replay an operation whose linked transfer was changed", async () => {
    rejectFinal = true;
    await expect(fundSavings("token", draft)).rejects.toThrow();
    transfer.properties.Amount.number = 2000;
    rejectFinal = false;
    await expect(fundSavings("token", draft)).rejects.toThrow("linked transfer changed");
  });
  it("serializes concurrent retries within a server instance", async () => {
    await Promise.all([fundSavings("token", draft), fundSavings("token", draft)]);
    expect(vi.mocked(notionFetchJson).mock.calls.filter(([, path]) => path === "/pages")).toHaveLength(2);
  });
});
