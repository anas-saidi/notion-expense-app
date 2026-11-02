import type { ContributionAgreement, PartnerAmounts } from "./contribution-agreements";

export type PlanAddition = { categoryId: string; amount: number; shares: PartnerAmounts; state: "funding" | "completed" };
export type PlanAdditionInput = { operationId: string; month: string; categoryId: string; amount: number; expectedVersion: string };
const fail = (message: string, status = 409): never => { throw Object.assign(new Error(message), { status }); };
/** Round one share and give the other the exact remainder, conserving cents. */
export function planAdditionAmounts(amount: number, shares: PartnerAmounts): PartnerAmounts {
  const total = Math.round(amount * 100);
  const anas = Math.round(total * shares.anas);
  return { anas: anas / 100, salma: (total - anas) / 100 };
}
export interface PlanAdditionDependencies {
  load(): Promise<ContributionAgreement | undefined>;
  save(current: ContributionAgreement, targets: PartnerAmounts, additions: Record<string, PlanAddition>): Promise<ContributionAgreement | null>;
  validateCategory(categoryId: string): Promise<string>;
  findFund(operationId: string, input: PlanAdditionInput, accountId: string): Promise<string | null>;
  createFund(input: PlanAdditionInput, accountId: string): Promise<string>;
}
/** Funding is resumable, not a cross-system transaction. An uncertain create is
 * never repeated; its unique name is looked up before contribution recovery. */
export async function addToPlan(input: PlanAdditionInput, deps: PlanAdditionDependencies) {
  if (typeof input.operationId !== "string" || typeof input.categoryId !== "string" || typeof input.month !== "string" || typeof input.expectedVersion !== "string" || !/^[a-f0-9-]{36}$/i.test(input.operationId ?? "") || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month ?? "") ||
    !/^[a-f0-9-]{32,36}$/i.test(input.categoryId ?? "") || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e9 || Math.round(input.amount * 100) / 100 !== input.amount || !/^[a-f0-9-]{36}$/i.test(input.expectedVersion ?? "")) fail("Provide a category, month and positive amount with at most two decimals.", 400);
  let current = await deps.load();
  if (!current) fail("Confirm this month's contributions before adding to the plan.");
  let operation = current!.planAdditions?.[input.operationId];
  if (operation && (operation.categoryId !== input.categoryId || operation.amount !== input.amount)) fail("Retry the original plan addition without changing its amount or category.");
  if (operation?.state === "completed") return current!;
  const accountId = await deps.validateCategory(input.categoryId);
  const resuming = Boolean(operation);
  if (!operation) {
    if (current!.version !== input.expectedVersion) fail("Contributions changed. Refresh and review the added amounts again.");
    const preview = planAdditionAmounts(input.amount, current!.shares);
    if (current!.targets.anas + preview.anas > 1e9 || current!.targets.salma + preview.salma > 1e9) fail("Contribution amounts exceed the supported limit.", 400);
    operation = { categoryId: input.categoryId, amount: input.amount, shares: current!.shares, state: "funding" };
    const prepared = await deps.save(current!, current!.targets, { ...current!.planAdditions, [input.operationId]: operation });
    if (!prepared) fail("Contributions changed. Refresh and review the added amounts again.");
    current = prepared!;
  }
  try {
    let fundId = await deps.findFund(input.operationId, input, accountId);
    if (!fundId && resuming) fail("Could not confirm the allocation yet. Retry this same addition later; do not start another one.");
    if (!fundId) fundId = await deps.createFund(input, accountId);
    if (!fundId) fail("Allocation confirmation is missing. Retry this same addition.");
    // A concurrent agreement edit may have changed targets. Preserve it and add
    // only the increment the user reviewed, using the operation's stored split.
    const latest = await deps.load();
    if (!latest?.planAdditions?.[input.operationId]) fail("Plan addition needs review. Its contribution record is missing.");
    if (latest!.planAdditions![input.operationId].state === "completed") return latest!;
    const extra = planAdditionAmounts(input.amount, operation!.shares);
    const targets = { anas: Math.round((latest!.targets.anas + extra.anas) * 100) / 100, salma: Math.round((latest!.targets.salma + extra.salma) * 100) / 100 };
    if (targets.anas > 1e9 || targets.salma > 1e9) fail("Contribution amounts exceed the supported limit.");
    const saved = await deps.save(latest!, targets, { ...latest!.planAdditions, [input.operationId]: { ...operation!, state: "completed" } });
    if (!saved) fail("The allocation is saved but contributions changed. Retry to finish the same addition.");
    return saved!;
  } catch (error) { throw Object.assign(error instanceof Error ? error : new Error("Could not finish the plan addition."), { pending: true }); }
}
