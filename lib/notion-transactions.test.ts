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

it("spends 6000 directly from funded savings only through its holding account", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ properties: {
    Available: { formula: { number: 6000 } }, Type: { multi_select: [{ name: "Saving" }] }, Default: { relation: [{ id: "joint" }] },
  } }) }));
  await expect(assertExpenseFitsBudget("t", { categoryId: "bedroom", amount: 6000, accountId: "joint" })).resolves.toBeUndefined();
  await expect(assertExpenseFitsBudget("t", { categoryId: "bedroom", amount: 6001, accountId: "joint" })).rejects.toMatchObject({ status: 409 });
  await expect(assertExpenseFitsBudget("t", { categoryId: "bedroom", amount: 6000, accountId: "personal" })).rejects.toMatchObject({ status: 409 });
});

describe("advance expenses", () => {
  const jointCategory = { ok: true, json: async () => ({ properties: { Available: { formula: { number: 0 } }, Category: { title: [{ plain_text: "Groceries" }] }, "Team Fund": { formula: { boolean: true } } } }) };
  const personalCategory = { ok: true, json: async () => ({ properties: { Available: { formula: { number: 0 } }, Category: { title: [{ plain_text: "Clothes" }] }, Owner: { select: { name: "Salma" } } } }) };
  const account = (label: string) => ({ ok: true, json: async () => ({ properties: { Name: { type: "title", title: [{ plain_text: label }] } } }) });

  it("lets a personal account pay an empty joint category as an advance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jointCategory).mockResolvedValueOnce(account("Wife Account")));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 500, accountId: "wife", advance: true })).resolves.toBeUndefined();
  });

  it("refuses an advance paid from the joint account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jointCategory).mockResolvedValueOnce(account("Joined Account")));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 500, accountId: "joint", advance: true })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses an advance into a personal category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(personalCategory));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 500, accountId: "wife", advance: true })).rejects.toMatchObject({ status: 409 });
  });

  it("still blocks an empty joint category without the advance flag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jointCategory));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 500, accountId: "wife" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("confirmed overspending", () => {
  it("saves real spending into an empty category once confirmed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(0)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 44, overspend: true })).resolves.toBeUndefined();
  });

  it("still asks first when the spending isn't confirmed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(categoryPage(10)));
    await expect(assertExpenseFitsBudget("t", { categoryId: "c", amount: 44 })).rejects.toMatchObject({ status: 409 });
  });
});
