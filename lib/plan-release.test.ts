import { describe, expect, it } from "vitest";
import { releaseFromPlan } from "./plan-addition";
import type { ContributionAgreement } from "./contribution-agreements";

const agreement = (over: Partial<ContributionAgreement> = {}): ContributionAgreement => ({
  month: "2026-11", original: { anas: 14909, salma: 8028 }, targets: { anas: 14909, salma: 8028 }, shares: { anas: 0.65, salma: 0.35 },
  confirmedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", version: "v1", ...over,
});

describe("releasing joint money from the plan", () => {
  it("lowers each partner's agreed amount by their share, once per release", async () => {
    let stored = agreement();
    const deps = { load: async () => stored, save: async (_c: ContributionAgreement, targets: ContributionAgreement["targets"], planAdditions: ContributionAgreement["planAdditions"]) => (stored = { ...stored, targets, planAdditions: planAdditions!, version: "v2" }) };
    const input = { fundId: "fund-1", month: "2026-11", categoryId: "self-care", amount: 200 };
    await releaseFromPlan(input, deps);
    expect(stored.targets).toEqual({ anas: 14779, salma: 7958 });
    await releaseFromPlan(input, deps);
    expect(stored.targets).toEqual({ anas: 14779, salma: 7958 });
    expect(stored.planAdditions?.["release:fund-1"].amount).toBe(-200);
  });
  it("does nothing without an agreement and never goes below zero", async () => {
    expect(await releaseFromPlan({ fundId: "f", month: "2026-11", categoryId: "c", amount: 50 }, { load: async () => undefined, save: async () => null })).toBeNull();
    let stored = agreement({ targets: { anas: 10, salma: 10 } });
    await releaseFromPlan({ fundId: "f", month: "2026-11", categoryId: "c", amount: 100 }, { load: async () => stored, save: async (_c, targets) => (stored = { ...stored, targets }) });
    expect(stored.targets).toEqual({ anas: 0, salma: 0 });
  });
  it("retries when contributions change underneath, then reports", async () => {
    await expect(releaseFromPlan({ fundId: "f", month: "2026-11", categoryId: "c", amount: 100 }, { load: async () => agreement(), save: async () => null })).rejects.toThrow(/Change agreed amounts/);
  });
});
