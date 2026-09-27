import { afterEach, describe, expect, it, vi } from "vitest";
import { assertExpenseFitsBudget, createNotionExpense } from "./notion-transactions";

const categoryPage = (available: number | null) => ({
  ok: true,
  json: async () => ({ properties: { Available: { formula: { number: available } }, Category: { title: [{ plain_text: "Groceries" }] } } }),
});

afterEach(() => vi.unstubAllGlobals());

describe("assertExpenseFitsBudget", () => {
  it("allows spending that fits what's available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(300)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 300 })).resolves.toBeUndefined();
  });

  it("rejects an unfunded category with a 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(0)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 20 })).rejects.toMatchObject({ status: 409, message: "No budget in Groceries. Move money into it first." });
  });

  it("rejects spending beyond what's available, naming the shortfall", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(100)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 150 })).rejects.toMatchObject({ status: 409, full: { code: "over_budget", shortfall: 50 } });
  });

  it("only checks the increase when editing within the same category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(10)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 110, originalAmount: 100 })).resolves.toBeUndefined();
  });
});

describe("createNotionExpense", () => {
  it("doesn't create the expense when the category can't cover it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(categoryPage(0));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createNotionExpense("t", { name: "pizza", amount: 19, accountId: "a", categoryId: "c", date: "2026-09-27" })).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
