import { describe, expect, it, vi } from "vitest";
import { addToPlan, planAdditionAmounts, type PlanAdditionDependencies, type PlanAdditionInput } from "./plan-addition";
import type { ContributionAgreement } from "./contribution-agreements";
const input: PlanAdditionInput = { operationId: "11111111-1111-4111-8111-111111111111", categoryId: "22222222-2222-4222-8222-222222222222", month: "2026-11", amount: 500.01, expectedVersion: "33333333-3333-4333-8333-333333333333" };
function setup() {
  let current: ContributionAgreement = { month: input.month, original: { anas: 650, salma: 350 }, targets: { anas: 650, salma: 350 }, shares: { anas: .65, salma: .35 }, version: input.expectedVersion, confirmedAt: "before", updatedAt: "before" };
  let fund: string | null = null;
  let version = 0;
  const deps: PlanAdditionDependencies = {
    load: vi.fn(async () => structuredClone(current)),
    save: vi.fn(async (expected, targets, planAdditions) => {
      if (current.version !== expected.version) return null;
      current = { ...current, targets: structuredClone(targets), planAdditions: structuredClone(planAdditions), version: `revision-${++version}` };
      return structuredClone(current);
    }),
    validateCategory: vi.fn(async () => "joint-account"),
    findFund: vi.fn(async () => fund),
    createFund: vi.fn(async () => { fund = "fund-id"; return fund; }),
  };
  return { deps, current: () => current, setFund: (value: string) => { fund = value; } };
}
describe("plan additions", () => {
  it("adds the allocation and split exactly once, retaining the original agreement", async () => {
    const { deps, current } = setup();
    const result = await addToPlan(input, deps);
    expect(result.targets).toEqual({ anas: 975.01, salma: 525 });
    expect(result.original).toEqual({ anas: 650, salma: 350 });
    expect(current().planAdditions?.[input.operationId].state).toBe("completed");
    await addToPlan(input, deps);
    expect(deps.createFund).toHaveBeenCalledTimes(1);
    expect(deps.save).toHaveBeenCalledTimes(2);
  });
  it("conserves a single cent rather than rounding both shares up", () => {
    expect(planAdditionAmounts(.01, { anas: .5, salma: .5 })).toEqual({ anas: .01, salma: 0 });
  });
  it.each([0, -5, 1.001, Infinity, NaN])("rejects invalid amount %s before writes", async amount => {
    const { deps } = setup();
    await expect(addToPlan({ ...input, amount }, deps)).rejects.toMatchObject({ status: 400 });
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.createFund).not.toHaveBeenCalled();
  });
  it("rejects a stale preview before writing an allocation", async () => {
    const { deps } = setup();
    await expect(addToPlan({ ...input, expectedVersion: "44444444-4444-4444-8444-444444444444" }, deps)).rejects.toThrow("Contributions changed");
    expect(deps.createFund).not.toHaveBeenCalled();
  });
  it("does not write when the category is not an eligible Joint category", async () => {
    const { deps } = setup();
    vi.mocked(deps.validateCategory).mockRejectedValueOnce(new Error("Not Joint"));
    await expect(addToPlan(input, deps)).rejects.toThrow("Not Joint");
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("recovers a confirmed fund after contribution saving fails without funding again", async () => {
    const { deps } = setup();
    const save = deps.save;
    deps.save = vi.fn(async (agreement, targets, additions) => vi.mocked(deps.save).mock.calls.length === 2 ? null : save(agreement, targets, additions));
    await expect(addToPlan(input, deps)).rejects.toMatchObject({ pending: true });
    const result = await addToPlan(input, deps);
    expect(result.targets).toEqual({ anas: 975.01, salma: 525 });
    expect(deps.createFund).toHaveBeenCalledTimes(1);
  });
  it("looks up a timed-out create on retry and never creates a second fund", async () => {
    const { deps, setFund } = setup();
    vi.mocked(deps.createFund).mockImplementationOnce(async () => { setFund("fund-id"); throw new Error("Network timeout"); });
    await expect(addToPlan(input, deps)).rejects.toMatchObject({ pending: true });
    expect((await addToPlan(input, deps)).targets.anas).toBe(975.01);
    expect(deps.createFund).toHaveBeenCalledTimes(1);
  });
  it("does not repeat a create whose outcome is still unknown", async () => {
    const { deps, current } = setup();
    vi.mocked(deps.createFund).mockRejectedValueOnce(new Error("Network timeout"));
    await expect(addToPlan(input, deps)).rejects.toMatchObject({ pending: true });
    await expect(addToPlan(input, deps)).rejects.toMatchObject({ pending: true });
    expect(deps.createFund).toHaveBeenCalledTimes(1);
    expect(current().targets).toEqual({ anas: 650, salma: 350 });
  });
  it("rejects a changed amount for the same operation even after completion", async () => {
    const { deps } = setup();
    await addToPlan(input, deps);
    await expect(addToPlan({ ...input, amount: 600 }, deps)).rejects.toThrow("original plan addition");
    expect(deps.createFund).toHaveBeenCalledTimes(1);
  });
});
