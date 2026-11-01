import type { ContributionAgreement } from "../../lib/contribution-agreements";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanReceipt, confirmPlanReceipt, persistMonthPlan, savedPlanReceipt } from "./month-plan-receipt";
afterEach(() => vi.unstubAllGlobals());
it("freezes the full plan across wallets, preserves cents, and excludes cleared categories", () => {
  const items = [{ id: "a", name: "Rent", scope: "joint" as const, amount: 8000.25 }, { id: "b", name: "Travel", scope: "salma" as const, amount: 500 }, { id: "c", name: "Old", scope: "anas" as const, amount: 0 }];
  const receipt = createPlanReceipt("2026-11", items);
  items[0].amount = 1;
  expect(receipt.total).toBe(8500.25);
  expect(receipt.wallets).toEqual({ joint: 8000.25, salma: 500, anas: 0 });
  expect(receipt.items).toHaveLength(2);
  expect(receipt.items[0].amount).toBe(8000.25);
});
it("does not confirm or save contributions when the plan fails", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ error: "Over capacity" }, { status: 409 }));
  vi.stubGlobal("fetch", request);
  await expect(persistMonthPlan({ month: "2026-11" }, { month: "2026-11" })).rejects.toThrow("Over capacity");
  expect(request).toHaveBeenCalledOnce();
});
it("keeps successful plan confirmation when contribution saving fails", async () => {
  const request = vi.fn().mockResolvedValueOnce(Response.json({ success: true })).mockRejectedValueOnce(new Error("Network unavailable"));
  vi.stubGlobal("fetch", request);
  expect((await persistMonthPlan({}, {})).warning).toContain("Contributions were not confirmed. Network unavailable");
  expect(request).toHaveBeenCalledTimes(2);
});
it("returns the confirmed agreement only after both writes succeed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ success: true })).mockResolvedValueOnce(Response.json({ agreement: { month: "2026-11" } })));
  expect(await persistMonthPlan({}, {})).toEqual({ agreement: { month: "2026-11" } });
});
it("saves an existing agreement's plan without creating another agreement", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ success: true }));
  vi.stubGlobal("fetch", request);
  expect(await persistMonthPlan({ month: "2026-11", budgetItems: [{ categoryId: "a", amount: 0 }] })).toEqual({});
  expect(request).toHaveBeenCalledOnce();
});

it("shows confirmed contribution targets independently of wallet allocations and snapshots them", () => {
  const receipt = createPlanReceipt("2026-11", [{ id: "a", name: "Rent", scope: "joint", amount: 8000 }]);
  const agreement = { month: "2026-11", targets: { anas: 3250.75, salma: 1750.25 } } as ContributionAgreement;
  const confirmed = confirmPlanReceipt(receipt, agreement);
  agreement.targets.anas = 0;
  expect(confirmed.contributions).toEqual({ anas: 3250.75, salma: 1750.25 });
  expect(confirmed.total).toBe(8000);
});
it("does not invent contributions after a failed confirmation or use another month's agreement", () => {
  const receipt = createPlanReceipt("2026-11", []);
  expect(confirmPlanReceipt(receipt, undefined, "Contributions were not confirmed").contributions).toBeUndefined();
  expect(confirmPlanReceipt(receipt, { month: "2026-10", targets: { anas: 500, salma: 0 } } as ContributionAgreement).contributions).toBeUndefined();
});

describe("saved plan receipt", () => {
  it("rebuilds a month from its planned amounts and agreed contributions", () => {
    const accounts = [{ id: "joint", label: "Joined Account", icon: "", type: "Joined", balance: 0, readyToAssign: 0 }] as any;
    const categories = [
      { id: "rent-1", name: "Rent", icon: null, type: [], owner: null, defaultAccount: "joint", available: 0, planned: 0, lastMonthSpent: null, isTeamFund: true },
      { id: "food-2", name: "Groceries", icon: null, type: [], owner: null, defaultAccount: "joint", available: 0, planned: 0, lastMonthSpent: null, isTeamFund: true },
    ] as any;
    const agreement = { month: "2026-11", original: { anas: 650, salma: 350 }, targets: { anas: 650, salma: 350 }, shares: { anas: .65, salma: .35 }, confirmedAt: "", updatedAt: "", version: "v" };
    const receipt = savedPlanReceipt("2026-11", {
      start: "2026-11-01", end: "2026-11-30", totalAssigned: 4500, totalSpent: 0, spentByCategory: [], contributionAgreements: [agreement],
      assignedByCategory: [{ categoryId: "rent1", accountId: "joint", total: 3500 }, { categoryId: "food-2", accountId: "joint", total: 1200 }, { categoryId: "food-2", accountId: "joint", total: -200 }],
    }, categories, accounts);
    expect(receipt.items.map(i => [i.name, i.amount])).toEqual([["Rent", 3500], ["Groceries", 1000]]);
    expect(receipt.total).toBe(4500);
    expect(receipt.contributions).toEqual({ anas: 650, salma: 350 });
    const personal = savedPlanReceipt("2026-11", { start: "2026-11-01", end: "2026-11-30", totalAssigned: 3500, totalSpent: 0, spentByCategory: [], contributionAgreements: [agreement], assignedByCategory: [{ categoryId: "rent-1", accountId: "joint", total: 3500 }] }, categories, accounts, "anas");
    expect(personal.items).toEqual([]);
    expect(personal.contributions).toBeUndefined();
  });
});
