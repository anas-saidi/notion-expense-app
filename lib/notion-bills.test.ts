import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecurringExpense, createBill, mapBillSchedule, payBill, readBills, textProperty, updateBill } from "./notion-bills";
import { notionFetchJson, queryDatabaseAll, readDatabaseSchema } from "./notion-api";
import { assertExpenseFitsBudget } from "./notion-transactions";
vi.mock("./notion-api", () => ({ notionFetchJson: vi.fn(), queryDatabaseAll: vi.fn(), readDatabaseSchema: vi.fn() }));
vi.mock("./notion-transactions", () => ({ assertExpenseFitsBudget: vi.fn() }));
const db = "1926a2be-8922-80be-968a-efa6e6dace95";
const cat = "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const catId = "11111111-1111-1111-1111-111111111111";
const accountId = "22222222-2222-2222-2222-222222222222";
const billId = "33333333-3333-3333-3333-333333333333";
const properties = { Type: { type: "select", select: { options: [{ name: "Due" }] } }, "Due Date": { type: "date" }, Repeat: { type: "select" }, Bill: { type: "relation", relation: { database_id: db } }, "Bill period": { type: "rich_text" }, "Bill metadata": { type: "rich_text" } };
const schedule = () => ({ id: billId, last_edited_time: "2026-10-03T01:00:00Z", parent: { database_id: db }, properties: { Name: { title: [{ plain_text: "Rent" }] }, Type: { select: { name: "Due" } }, Amount: { number: 600 }, Category: { relation: [{ id: catId }] }, "Due Date": { date: { start: "2026-10-05" } }, Repeat: { select: { name: "Monthly" } }, "Bill metadata": { rich_text: [{ plain_text: '{"v":1}' }] } } });
const draft = { name: "Rent", amount: 600, categoryId: catId, dueDate: "2026-10-05", repeat: "Monthly" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readDatabaseSchema).mockResolvedValue({ properties });
  vi.mocked(queryDatabaseAll).mockImplementation(async (_token, _db, body: any) => body.filter.or ? [schedule()] : []);
  vi.mocked(notionFetchJson).mockImplementation(async (_token, path, opts: any) => {
    if (path === `/pages/${catId}`) return { status: 200, data: { parent: { database_id: cat }, properties: {} } };
    if (path === `/pages/${accountId}`) return { status: 200, data: { parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: {} } };
    if (path === "/pages") return { status: 200, data: { id: "payment", properties: opts.body.properties } };
    return { status: 200, data: schedule() };
  });
});
describe("Notion bills contract", () => {
  it("writes a schedule with no actual Date or Account, respecting Due Date casing", async () => {
    await createBill("token", draft);
    const call = vi.mocked(notionFetchJson).mock.calls.find(c => c[1] === "/pages")!;
    expect((call[2]!.body as any).properties).toMatchObject({ Type: { select: { name: "Due" } }, Date: { date: null }, Account: { relation: [] }, "Due Date": { date: { start: "2026-10-05" } } });
    expect(assertExpenseFitsBudget).not.toHaveBeenCalled();
  });
  it("creates linked expenses without updating the schedule's expected amount", async () => {
    await payBill("token", { billId, period: "2026-10", amount: 550, date: "2026-10-06", accountId });
    expect(assertExpenseFitsBudget).toHaveBeenCalledWith("token", { categoryId: catId, amount: 550 });
    const call = vi.mocked(notionFetchJson).mock.calls.find(c => c[1] === "/pages")!;
    expect((call[2]!.body as any).properties).toMatchObject({ Type: { select: { name: "Expense" } }, Amount: { number: 550 }, Bill: { relation: [{ id: billId }] }, "Bill period": { rich_text: [{ text: { content: "2026-10" } }] } });
    expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[2]?.method === "PATCH")).toBe(false);
  });
  it("does not write a payment that fails the budget gate", async () => {
    vi.mocked(assertExpenseFitsBudget).mockRejectedValue(new Error("Short budget"));
    await expect(payBill("token", { billId, period: "2026-10", amount: 550, date: "2026-10-06", accountId })).rejects.toThrow("Short budget");
    expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[1] === "/pages")).toBe(false);
  });
  it("resolves ambiguous payment creates by querying Bill + period", async () => {
    const base = vi.mocked(notionFetchJson).getMockImplementation()!;
    vi.mocked(notionFetchJson).mockImplementation(async (token, path, opts) => { if (path === "/pages") throw new Error("timeout"); return base(token, path, opts); });
    vi.mocked(queryDatabaseAll).mockImplementation(async (_t, _d, body: any) => {
      if (body.filter.or) return [schedule()];
      if (body.filter.and?.length === 3) return [{ id: "settled", properties: { Type: { select: { name: "Expense" } }, Bill: { relation: [{ id: billId }] }, "Bill period": { rich_text: [{ plain_text: "2026-10" }] }, Date: { date: { start: "2026-10-06" } }, Amount: { number: 550 }, Category: { relation: [{ id: catId }] }, Account: { relation: [{ id: accountId }] } } }];
      return [];
    });
    expect((await payBill("token", { billId, period: "2026-10", amount: 550, date: "2026-10-06", accountId })).id).toBe("settled");
    expect(vi.mocked(notionFetchJson).mock.calls.filter(c => c[1] === "/pages")).toHaveLength(1);
  });
  it("rejects a paid occurrence before attempting another expense", async () => {
    vi.mocked(queryDatabaseAll).mockImplementation(async (_t, _d, body: any) => [schedule(), { id: "existing", properties: { Type: { select: { name: "Expense" } }, Bill: { relation: [{ id: billId }] }, "Bill period": { rich_text: [{ plain_text: "2026-10" }] }, Date: { date: { start: "2026-10-06" } }, Amount: { number: 600 }, Category: { relation: [{ id: catId }] }, Account: { relation: [{ id: accountId }] } } }]);
    await expect(payBill("token", { billId, period: "2026-10", amount: 600, date: "2026-10-06", accountId })).rejects.toMatchObject({ status: 409 });
    expect(assertExpenseFitsBudget).not.toHaveBeenCalled();
    expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[1] === "/pages")).toBe(false);
  });
  it("fails with a conflict if metadata keeps changing instead of overwriting it", async () => {
    const base = vi.mocked(notionFetchJson).getMockImplementation()!;
    let reads = 0;
    vi.mocked(notionFetchJson).mockImplementation(async (token, path, opts) => {
      if (path === `/pages/${billId}` && !opts?.method) return { status: 200, data: { ...schedule(), last_edited_time: String(++reads) } };
      return base(token, path, opts);
    });
    await expect(updateBill("token", { action: "skip", billId, period: "2026-10" })).rejects.toMatchObject({ status: 409 });
    expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[2]?.method === "PATCH")).toBe(false);
  });
  it("does not spread an occurrence override into older expectations during future edits", async () => {
    const original = schedule(); original.properties["Bill metadata"] = { rich_text: [{ plain_text: JSON.stringify({ v: 1, overrides: { "2026-10": { amount: 650 } } }) }] };
    const base = vi.mocked(notionFetchJson).getMockImplementation()!;
    vi.mocked(notionFetchJson).mockImplementation(async (token, path, opts) => path === `/pages/${billId}` ? { status: 200, data: original } : base(token, path, opts));
    await updateBill("token", { action: "edit", target: "future", billId, period: "2026-11", ...draft, dueDate: "2026-11-05", amount: 800 });
    const call = vi.mocked(notionFetchJson).mock.calls.find(c => c[2]?.method === "PATCH")!;
    const meta = JSON.parse((call[2]!.body as any).properties["Bill metadata"].rich_text[0].text.content);
    expect(meta.revisions[0].amount).toBe(600); expect(meta.overrides["2026-10"].amount).toBe(650);
  });
  it("fails the entire read when the combined query fails rather than showing paid bills as due", async () => {
    vi.mocked(queryDatabaseAll).mockRejectedValue(new Error("Payments unavailable"));
    await expect(readBills("token")).rejects.toThrow("Payments unavailable");
  });
  it("rejects schedule rows with a payment Date or Account", () => {
    const page: any = schedule(); page.properties.Date = { date: { start: "2026-10-01" } };
    expect(() => mapBillSchedule(page, "Due Date")).toThrow("empty payment Date and Account");
  });
  it("splits and joins metadata larger than one rich-text item", () => {
    const value = JSON.stringify({ v: 1, skipped: Array(500).fill("2026-10") });
    const rich = textProperty(value); expect(rich.rich_text.length).toBeGreaterThan(1);
    const page: any = schedule(); page.properties["Bill metadata"] = rich;
    expect(mapBillSchedule(page, "Due Date").metadata.skipped).toHaveLength(500);
  });
  it("records future-edit revisions so overdue expectations stay unchanged", async () => {
    await updateBill("token", { action: "edit", target: "future", billId, period: "2026-11", ...draft, dueDate: "2026-11-05", amount: 800 });
    const call = vi.mocked(notionFetchJson).mock.calls.find(c => c[2]?.method === "PATCH")!;
    const props = (call[2]!.body as any).properties;
    expect(props.Amount).toEqual({ number: 800 });
    expect(JSON.parse(props["Bill metadata"].rich_text[0].text.content).revisions[0]).toMatchObject({ until: "2026-10", amount: 600, categoryId: catId });
  });
});

describe("expense composer recurrence", () => {
  const input = { ...draft, date: draft.dueDate, accountId };
  it("creates one schedule and records its initial occurrence as a linked paid expense", async () => {
    const original = vi.mocked(notionFetchJson).getMockImplementation()!;
    vi.mocked(notionFetchJson).mockImplementation(async (token, path, options: any) => {
      if (path === "/pages" && options.body.properties.Type.select.name === "Due") return { status: 200, data: { ...schedule(), properties: options.body.properties } };
      return original(token, path, options);
    });
    const result = await createRecurringExpense("token", input);
    expect(result.billId).toBe(billId);
    const writes = vi.mocked(notionFetchJson).mock.calls.filter(call => call[1] === "/pages");
    expect(writes).toHaveLength(2);
    const expense = (writes[1][2] as any).body.properties;
    expect(expense.Type.select.name).toBe("Expense");
    expect(expense.Bill.relation).toEqual([{ id: billId }]);
    expect(expense["Bill period"].rich_text[0].text.content).toBe("2026-10");
  });
  it("returns the saved schedule identity when payment fails so a retry can reuse it", async () => {
    const original = vi.mocked(notionFetchJson).getMockImplementation()!;
    vi.mocked(notionFetchJson).mockImplementation(async (token, path, options: any) => {
      if (path === "/pages" && options.body.properties.Type.select.name === "Due") return { status: 200, data: { ...schedule(), properties: options.body.properties } };
      if (path === "/pages") throw Object.assign(new Error("Payment write rejected"), { status: 400 });
      return original(token, path, options);
    });
    await expect(createRecurringExpense("token", input)).rejects.toMatchObject({ billId, status: 400 });
    expect(vi.mocked(notionFetchJson).mock.calls.filter(call => call[1] === "/pages" && (call[2] as any).body.properties.Type.select.name === "Due")).toHaveLength(1);
  });
  it("leaves no schedule when the category cannot fund the initial expense", async () => {
    vi.mocked(assertExpenseFitsBudget).mockRejectedValue(new Error("Short by 100"));
    await expect(createRecurringExpense("token", input)).rejects.toThrow("Short by 100");
    expect(vi.mocked(notionFetchJson).mock.calls.some(call => call[1] === "/pages")).toBe(false);
  });
  it("recovers an already recorded payment without spending again or rechecking its reduced balance", async () => {
    vi.mocked(queryDatabaseAll).mockImplementation(async (_token, _db, body: any) => [schedule(), { id: "paid", properties: { Type: { select: { name: "Expense" } }, Bill: { relation: [{ id: billId }] }, "Bill period": textProperty("2026-10"), Date: { date: { start: input.date } }, Amount: { number: 600 }, Category: { relation: [{ id: catId }] }, Account: { relation: [{ id: accountId }] } } }]);
    const payment = await createRecurringExpense("token", { ...input, billId });
    expect(payment.id).toBe("paid");
    expect(assertExpenseFitsBudget).not.toHaveBeenCalled();
    expect(vi.mocked(notionFetchJson).mock.calls.some(call => call[1] === "/pages")).toBe(false);
  });
});
