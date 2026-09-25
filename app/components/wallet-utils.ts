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
      // Savings accounts are never part of operational planned budget
      if (label.includes("saving")) return false;
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

// Availability is a current ledger snapshot, never reconstructed from monthly activity.
export function cashBackingGap(available: number | null, cash: number | null): number | null {
  return available === null || cash === null ? null : Math.max(0, available - cash);
}

export function getCategoryAvailableByScope(categories: Category[], accounts: Account[] = []): Record<BudgetScope, number> {
  const isSavingsCategory = (category: Category) => {
    const types = category.type.map(value => value.toLowerCase());
    if (types.some(value => value.includes("team") || value.includes("household"))) return false;
    return types.some(value => ["saving", "sinking", "goal", "fund"].some(kind => value.includes(kind)));
  };
    const sum = (scope: BudgetScope) =>
      categories
        .filter(c => categoryMatchesScope(c, scope, accounts) && !isSavingsCategory(c))
        .reduce((s, c) => s + (c.available ?? 0), 0);
    return { joint: sum("joint"), anas: sum("anas"), salma: sum("salma") };
}
