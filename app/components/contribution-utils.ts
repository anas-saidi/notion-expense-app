import type { Account, Category, MonthlySummary, Transaction } from "./app-types";
import { getCategoryAvailableByScope } from "./wallet-utils";
import { categoryMatchesScope } from "./app-utils";

export type ContributionStatus = {
  fundingGap: number;
  openingJointBalance: number;
  jointPlan: number;
  partnerRequirement: number;
  anasPlan: number;
  salmaPlan: number;
  anasActual: number;
  salmaActual: number;
  anasDirectSpend: number;
  salmaDirectSpend: number;
  anasTransferred: number;
  salmaTransferred: number;
};

const accountLabel = (accounts: Account[], id: string | null | undefined) =>
  id ? (accounts.find((account) => account.id === id)?.label ?? "").toLowerCase() : "";

export function calculateContributionStatus({
  accounts,
  categories,
  transactions,
  monthlySummary,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  monthlySummary: MonthlySummary;
}): ContributionStatus | null {
  const joinedAccount = accounts.find((account) =>
    !account.label.toLowerCase().includes("saving") && account.label.toLowerCase().includes("joined"),
  );
  if (!joinedAccount) return null;

  const anasAccount = accounts.find((account) =>
    !account.label.toLowerCase().includes("saving") && account.label.toLowerCase().includes("hubb"),
  );
  const salmaAccount = accounts.find((account) =>
    !account.label.toLowerCase().includes("saving") && account.label.toLowerCase().includes("wife"),
  );
  const anasPercent = anasAccount?.contributionPercent ?? null;
  const salmaPercent = salmaAccount?.contributionPercent ?? null;
  if (anasPercent == null || salmaPercent == null || anasPercent < 0 || salmaPercent < 0 ||
      Math.abs(anasPercent + salmaPercent - 1) > 0.000001 || joinedAccount.balance == null) return null;
  const jointCategories = categories.filter(category => categoryMatchesScope(category, "joint", accounts));
  if (jointCategories.some(category => category.available == null)) return null;

  const jointAssignments = monthlySummary.assignedByCategory.filter((entry) => {
    const label = accountLabel(accounts, entry.accountId);
    if (label.includes("joined")) return true;
    if (label.includes("hubb") || label.includes("wife") || label.includes("saving")) return false;
    const category = categories.find((candidate) => candidate.id === entry.categoryId);
    return category ? categoryMatchesScope(category, "joint", accounts) : false;
  });
  const jointPlan = jointAssignments.reduce((sum, entry) => sum + entry.total, 0);

  let joinedInflows = 0;
  let joinedOutflows = 0;
  let anasTransferred = 0;
  let salmaTransferred = 0;
  let anasDirectSpend = 0;
  let salmaDirectSpend = 0;

  for (const transaction of transactions) {
    if (transaction.type === "Transfer") {
      if (transaction.toAccountId === joinedAccount.id) {
        joinedInflows += transaction.amount;
        const fromLabel = accountLabel(accounts, transaction.fromAccountId);
        if (fromLabel.includes("hubb")) anasTransferred += transaction.amount;
        else if (fromLabel.includes("wife")) salmaTransferred += transaction.amount;
      }
      if (transaction.fromAccountId === joinedAccount.id) {
        joinedOutflows += transaction.amount;
        const toLabel = accountLabel(accounts, transaction.toAccountId);
        if (toLabel.includes("hubb")) anasTransferred -= transaction.amount;
        else if (toLabel.includes("wife")) salmaTransferred -= transaction.amount;
      }
      continue;
    }

    if (transaction.type === "Income") {
      if (transaction.accountId === joinedAccount.id || transaction.toAccountId === joinedAccount.id) {
        joinedInflows += transaction.amount;
      }
      continue;
    }

    if (transaction.accountId === joinedAccount.id) joinedOutflows += transaction.amount;

    if (!transaction.category) continue;
    const category = categories.find((candidate) => candidate.id === transaction.category);
    if (!category || !categoryMatchesScope(category, "joint", accounts)) continue;
    const payerLabel = accountLabel(accounts, transaction.accountId);
    if (payerLabel.includes("hubb")) anasDirectSpend += transaction.amount;
    else if (payerLabel.includes("wife")) salmaDirectSpend += transaction.amount;
  }

  const openingJointBalance = (joinedAccount.balance ?? 0) - joinedInflows + joinedOutflows;
  // Current ledger availability includes carry-over and category rebalancing.
  // Reconstruct the total funding target from credited contributions + cash still needed.
  // Once both displayed dues are transferred, cash covers availability exactly.
  const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
  const anasActual = anasTransferred + anasDirectSpend;
  const salmaActual = salmaTransferred + salmaDirectSpend;
  const gapCents = Math.max(0, cents(getCategoryAvailableByScope(categories, accounts).joint) - cents(joinedAccount.balance));
  const targetCents = cents(anasActual) + cents(salmaActual) + gapCents;
  // A partner already above their share owes zero; cap the other partner at
  // the household shortfall so paying dues never demands an implicit refund.
  const anasDueCents = Math.max(0, Math.min(gapCents, Math.round(targetCents * anasPercent) - cents(anasActual)));
  const salmaDueCents = gapCents - anasDueCents;
  const fundingGap = gapCents / 100;
  const anasPlan = anasActual + anasDueCents / 100;
  const salmaPlan = salmaActual + salmaDueCents / 100;
  const partnerRequirement = anasPlan + salmaPlan;

  return {
    fundingGap,
    openingJointBalance,
    jointPlan,
    partnerRequirement,
    anasPlan,
    salmaPlan,
    anasActual,
    salmaActual,
    anasDirectSpend,
    salmaDirectSpend,
    anasTransferred,
    salmaTransferred,
  };
}
