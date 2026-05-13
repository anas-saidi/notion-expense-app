import type { Account, BudgetScope, Category, Transaction } from "./app-types";

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const today = () => toLocalDateString(new Date());

export const shiftDate = (dateStr: string, days: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
};

export const MONEY_CURRENCY = "MAD";

export const fmt = (n: number) => n.toLocaleString("fr-MA");

export const fmtMoney = (n: number) => `${fmt(n)} ${MONEY_CURRENCY}`;

export const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const monthBounds = (dateStr: string) => {
  const [year, month] = dateStr.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = toLocalDateString(endDate);
  return { start, end };
};

export const BUDGET_SCOPE_LABELS: Record<BudgetScope, string> = {
  joint: "Joint",
  anas: "Anas",
  salma: "Salma",
};

export const isSavingsAccount = (account: Account) => {
  const value = account.type?.toLowerCase() ?? "";
  return value.includes("saving");
};

export const getLeftToAssignByScope = (accounts: Account[]): Record<BudgetScope, number> => {
  const norm = (value: string) => value.toLowerCase();
  const applyJointDue = (account: Account) => {
    const base = account.readyToAssign ?? 0;
    const jointDue = account.jointDue ?? 0;
    if (jointDue <= 0) return base;
    return base - jointDue;
  };

  const salmaTotal = accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("wife")) return sum;
    return sum + applyJointDue(account);
  }, 0);

  const anasTotal = accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("hubb")) return sum;
    return sum + applyJointDue(account);
  }, 0);

  const salma = Math.max(0, salmaTotal);
  const anas = Math.max(0, anasTotal);

  return {
    joint: salma + anas,
    salma,
    anas,
  };
};

export const getCategoryScope = (category: Category): BudgetScope | null => {
  if (category.isTeamFund) return "joint";

  const owner = category.owner?.trim().toLowerCase();
  if (owner?.includes("anas") || owner?.includes("hubb") || owner?.includes("husband")) return "anas";
  if (owner?.includes("salma") || owner?.includes("wife")) return "salma";

  if (category.type.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("team") || normalized.includes("household");
  })) {
    return "joint";
  }

  return null;
};

export const categoryMatchesScope = (category: Category, scope: BudgetScope) =>
  getCategoryScope(category) === scope;

export const transactionMatchesScope = (
  transaction: Transaction,
  categories: Category[],
  scope: BudgetScope,
) => {
  if (!transaction.category) return true;
  const category = categories.find((entry) => entry.id === transaction.category);
  if (!category) return true;
  return categoryMatchesScope(category, scope);
};

export const categoryIdMatchesScope = (
  categoryId: string | null | undefined,
  categories: Category[],
  scope: BudgetScope,
) => {
  if (!categoryId) return true;
  const category = categories.find((entry) => entry.id === categoryId);
  if (!category) return true;
  return categoryMatchesScope(category, scope);
};
