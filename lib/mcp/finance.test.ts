import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ query: vi.fn(), expense: vi.fn(), rebalance: vi.fn(), income: vi.fn(), bills: vi.fn(), once: vi.fn(), accountRead: vi.fn() }));
vi.mock("../notion-api", () => ({ queryDatabaseAll: mock.query }));
vi.mock("../notion-transactions", () => ({ createNotionExpense: mock.expense }));
vi.mock("../notion-bills", () => ({ readBills: mock.bills }));
vi.mock("./operations", () => ({ mcpOperations: () => ({ once: mock.once }) }));
vi.mock("../mirror/routes", () => ({ withMirrorMutation: (f: any) => f }));
vi.mock("../../app/api/accounts/route", () => ({ GET: mock.accountRead }));
vi.mock("../../app/api/categories/route", () => ({ GET: vi.fn() }));
vi.mock("../../app/api/transactions/route", () => ({ GET: vi.fn() }));
vi.mock("../../app/api/monthly-summary/route", () => ({ GET: vi.fn() }));
vi.mock("../../app/api/monthly-income/route", () => ({ POST: mock.income }));
vi.mock("../../app/api/transfer/route", () => ({ POST: mock.rebalance }));
import { write } from "./finance";
import { billToday } from "../bills";
const account = "11111111-1111-4111-8111-111111111111";
const from = "22222222-2222-4222-8222-222222222222";
const to = "33333333-3333-4333-8333-333333333333";
const page = (id: string, available: number | null, extra: any = {}) => ({ id, properties: { Category: { title: [{ plain_text: id }] }, Default: { relation: [{ id: account }] }, Available: { number: available }, "Team Fund": { formula: { boolean: true } }, ...extra } });
const wallet = { id: account, properties: { Name: { type: "title", title: [{ plain_text: "Joined Account" }] }, Disabled: { checkbox: false } } };
let categoryPages: any[];
let accountPages: any[];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NOTION_TOKEN", "test-notion-token");
  categoryPages = [page(from, 100), page(to, 50)]; accountPages = [wallet];
  mock.query.mockImplementation(async (_: any, db: string) => db.includes("8029") ? categoryPages : accountPages);
  mock.once.mockImplementation(async (_scope: any, _id: any, _tool: any, _values: any, run: any) => run());
  mock.expense.mockResolvedValue({ id: "saved-expense" });
  mock.rebalance.mockResolvedValue(Response.json({ success: true, id: "saved-move" }));
  mock.income.mockResolvedValue(Response.json({ success: true, id: "saved-income" }));
  mock.bills.mockResolvedValue({ schedules: [], payments: [] });
});
const move = () => ({ requestId: "req", fromCategoryId: from, toCategoryId: to, amount: 20, date: billToday() });
it("reads live entity records, rejects disabled accounts, and cannot use a cached catalog to authorize writes", async () => {
  accountPages = [{ ...wallet, properties: { ...wallet.properties, Disabled: { checkbox: true } } }];
  await expect(write("record_expense", { requestId: "req", accountId: account, categoryId: from, amount: 20 })).rejects.toThrow("active account");
  expect(mock.expense).not.toHaveBeenCalled(); expect(mock.accountRead).not.toHaveBeenCalled();
});
it("rejects unknown, archived or snoozed categories and unknown balances", async () => {
  for (const extra of [{ Archived: { checkbox: true } }, { Snooze: { checkbox: true } }]) {
    categoryPages = [page(from, 100, extra)];
    await expect(write("record_expense", { requestId: "req", accountId: account, categoryId: from, amount: 20 })).rejects.toThrow("active category");
  }
  categoryPages = [page(from, null)];
  await expect(write("record_expense", { requestId: "req", accountId: account, categoryId: from, amount: 20 })).rejects.toThrow("could not be verified");
  expect(mock.expense).not.toHaveBeenCalled();
});
it("delegates valid expenses to the existing budget-gated writer", async () => {
  const result = await write("record_expense", { requestId: "req", accountId: account, categoryId: from, amount: 20, name: "Lunch", date: billToday() });
  expect(result).toMatchObject({ success: true, transaction: { id: "saved-expense" } });
  expect(mock.expense).toHaveBeenCalledWith("test-notion-token", expect.objectContaining({ amount: 20, categoryId: from, accountId: account }));
});
it("blocks moves with insufficient funds or unavailable bill data", async () => {
  await expect(write("rebalance_budget", { ...move(), amount: 101 })).rejects.toThrow("Insufficient free");
  mock.bills.mockRejectedValueOnce(new Error("Bills unavailable"));
  await expect(write("rebalance_budget", move())).rejects.toThrow("Bills unavailable");
  expect(mock.rebalance).not.toHaveBeenCalled();
});
it("protects unpaid bill reservations before a budget move", async () => {
  mock.bills.mockResolvedValue({ schedules: [{ id: "bill", name: "Rent", amount: 90, categoryId: from, dueDate: billToday(), repeat: "None", metadata: { v: 1 } }], payments: [] });
  await expect(write("rebalance_budget", move())).rejects.toThrow("Insufficient free");
  expect(mock.rebalance).not.toHaveBeenCalled();
});
it("blocks savings and cross-wallet moves", async () => {
  categoryPages = [page(from, 100, { Type: { multi_select: [{ name: "Savings" }] } }), page(to, 100)];
  await expect(write("rebalance_budget", move())).rejects.toThrow("savings");
  categoryPages = [page(from, 100), page(to, 100, { "Team Fund": { formula: { boolean: false } }, Owner: { select: { name: "Anas" } } })];
  await expect(write("rebalance_budget", move())).rejects.toThrow("one wallet");
  expect(mock.rebalance).not.toHaveBeenCalled();
});
it("rejects historical rebalances and saves a permitted current-month move", async () => {
  await expect(write("rebalance_budget", { ...move(), date: "2000-01-01" })).rejects.toThrow("current month");
  expect(await write("rebalance_budget", move())).toMatchObject({ success: true, id: "saved-move" });
});
