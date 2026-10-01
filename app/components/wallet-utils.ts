import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { categoryMatchesScope, getCategoryScope } from "./app-utils";

// Assignment ownership follows funding accounts; spending follows category ownership.
export function scopeMonthlySummary(monthlySummary: MonthlySummary, categories: Category[], accounts: Account[], scope: BudgetScope): MonthlySummary {
    const accountLabel = (entry: { accountId?: string | null }) => {
      if (!entry.accountId) return "";
      return (accounts.find(a => a.id === entry.accountId)?.label ?? "").toLowerCase();
    };

    const assignmentMatchesScope = (entry: { categoryId: string; accountId?: string | null }) => {
      const label = accountLabel(entry);
      // Savings allocations still belong to a wallet. A shared savings account
      // does not identify its owner, so use the category's ownership instead.
      if (label.includes("saving")) {
        const category = categories.find(candidate => candidate.id === entry.categoryId);
        return !!category && getCategoryScope(category, accounts) === scope;
      }
      // Primary: use account label (ground truth for who made the assignment)
      if (label.includes("hubb")) return scope === "anas";
      if (label.includes("wife")) return scope === "salma";
      if (label.includes("joined")) return scope === "joint";
      // Fallback: use category scope when account is unknown
      const cat = categories.find(c => c.id === entry.categoryId);
      if (!cat) return scope === "joint";
      const catScope = getCategoryScope(cat, accounts);
      return catScope === scope;
    };

    const assignedByCategory = monthlySummary.assignedByCategory.filter(assignmentMatchesScope);

    const categoryIds = new Set(
      categories.filter(c => categoryMatchesScope(c, scope, accounts)).map(c => c.id),
    );
    const spentByCategory = monthlySummary.spentByCategory.filter((entry) => categoryIds.has(entry.categoryId));

    return {
      ...monthlySummary,
      totalAssigned: assignedByCategory.reduce((sum, entry) => sum + entry.total, 0),
      totalSpent: spentByCategory.reduce((sum, entry) => sum + entry.total, 0),
      assignedByCategory,
      spentByCategory,
    };
}

/** Savings-type categories sit outside the monthly spending picture. */
export function isSavingsCategory(category: Category): boolean {
  const types = category.type.map(value => value.toLowerCase());
  if (types.some(value => value.includes("team") || value.includes("household"))) return false;
  return types.some(value => ["saving", "sinking", "goal", "fund"].some(kind => value.includes(kind)));
}

/** All allocations owned by a wallet, including money set aside for savings. */
export function getCategoryAllocatedByScope(categories: Category[], accounts: Account[] = []): Record<BudgetScope, number> {
    const sum = (scope: BudgetScope) =>
      categories
        .filter(c => categoryMatchesScope(c, scope, accounts))
        .reduce((s, c) => s + (c.available ?? 0), 0);
    return { joint: sum("joint"), anas: sum("anas"), salma: sum("salma") };
}

/** Operational category balances backed by the spending accounts. */
export function getCategoryAvailableByScope(categories: Category[], accounts: Account[] = []): Record<BudgetScope, number> {
  return getCategoryAllocatedByScope(categories.filter(category => !isSavingsCategory(category)), accounts);
}
