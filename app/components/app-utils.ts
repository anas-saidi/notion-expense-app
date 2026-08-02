import type { Account, BudgetScope, Category, Transaction } from "./app-types";

/**
 * Safely evaluate a simple arithmetic expression string (+ - * /).
 * No eval() — uses a recursive descent parser.
 * Returns 0 for empty or invalid input.
 */
export function evalExpr(input: string): number {
  const s = input.replace(/\s/g, "");
  if (!s) return 0;
  let pos = 0;

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/")) {
      const op = s[pos++];
      const right = parseFactor();
      left = op === "*" ? left * right : right !== 0 ? left / right : 0;
    }
    return left;
  }

  function parseFactor(): number {
    const neg = s[pos] === "-" && pos++;
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    const n = parseFloat(s.slice(start, pos)) || 0;
    return neg ? -n : n;
  }

  try {
    const result = parseExpr();
    return isFinite(result) ? Math.round(result * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

/** Returns true when the input string looks like an expression (contains operators after digits) */
export function isExpression(input: string): boolean {
  return /[0-9][+\-*/][0-9]/.test(input.replace(/\s/g, ""));
}

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

export const getBalanceByScope = (accounts: Account[]): Record<BudgetScope, number> => {
  const norm = (value: string) => value.toLowerCase();

  const salmaTotal = accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("wife")) return sum;
    return sum + (account.balance ?? 0);
  }, 0);

  const anasTotal = accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("hubb")) return sum;
    return sum + (account.balance ?? 0);
  }, 0);

  const jointTotal = accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("joined")) return sum;
    return sum + (account.balance ?? 0);
  }, 0);

  return {
    joint: jointTotal,
    salma: salmaTotal,
    anas: anasTotal,
  };
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

/**
 * Money literally sitting in the joint bank account(s) that hasn't been
 * assigned to any category yet — distinct from `getLeftToAssignByScope`,
 * which sums the *personal* accounts' ready-to-assign (money each partner
 * could still contribute to joint budgets).
 */
export const getJointAccountUnassigned = (accounts: Account[]): number => {
  const norm = (value: string) => value.toLowerCase();
  return accounts.reduce((sum, account) => {
    if (isSavingsAccount(account)) return sum;
    if (!norm(account.label).includes("joined")) return sum;
    return sum + Math.max(0, account.readyToAssign ?? 0);
  }, 0);
};

export const scopeFromAccountLabel = (label: string): BudgetScope | null => {
  const l = label.toLowerCase();
  if (l.includes("hubb") || l.includes("husband") || l.includes("anas")) return "anas";
  if (l.includes("wife") || l.includes("salma")) return "salma";
  if (l.includes("joined") || l.includes("joint")) return "joint";
  return null;
};

export const getCategoryScope = (category: Category, accounts?: Account[]): BudgetScope | null => {
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

  // Fall back to category name — catches cases where Owner field isn't set in Notion
  // but the name itself encodes the owner (e.g. "Hubby Family", "Salma Personal")
  const name = category.name?.trim().toLowerCase() ?? "";
  if (name.includes("hubb") || name.includes("husband") || name.startsWith("anas")) return "anas";
  if (name.includes("wife") || name.startsWith("salma")) return "salma";

  // Fall back to default account label — reliable when Owner field isn't writable
  if (accounts && category.defaultAccount) {
    const account = accounts.find((a) => a.id === category.defaultAccount);
    if (account) {
      const fromAccount = scopeFromAccountLabel(account.label);
      if (fromAccount) return fromAccount;
    }
  }

  // Default to joint — an uncategorized category is shared, not invisible
  return "joint";
};

export const categoryMatchesScope = (category: Category, scope: BudgetScope) =>
  getCategoryScope(category) === scope;

export const transactionMatchesScope = (
  transaction: Transaction,
  categories: Category[],
  scope: BudgetScope,
  accounts?: Account[],
) => {
  if (!transaction.category) return true;
  const category = categories.find((entry) => entry.id === transaction.category);
  if (!category) return true;

  const catScope = getCategoryScope(category);
  if (catScope !== null) return catScope === scope;

  // Category has no determinable scope — fall back to the transaction's account label
  if (transaction.accountId && accounts) {
    const account = accounts.find(a => a.id === transaction.accountId);
    if (account) {
      const label = account.label.toLowerCase();
      if (label.includes("hubb")) return scope === "anas";
      if (label.includes("wife")) return scope === "salma";
      if (label.includes("joined")) return scope === "joint";
    }
  }

  // Can't determine scope — include in joint only to avoid polluting personal views
  return scope === "joint";
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
