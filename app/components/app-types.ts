export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: string[];
  owner: string | null;
  defaultAccount: string | null;
  available: number | null;
  planned: number | null;
  /** Notion "Overall Goal": the savings target, if one is set. */
  goal?: number | null;
  /** Notion "Goal Date" (YYYY-MM-DD): when the goal should be reached. */
  goalDate?: string | null;
  lastMonthSpent: number | null;
  isTeamFund: boolean;
  snoozed?: boolean;
  archived?: boolean;
};

export type BudgetScope = "joint" | "anas" | "salma";

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string | null;
  accountId: string | null;
  type?: "Expense" | "Income" | "Transfer" | null;
  fromCategoryId?: string | null;
  toCategoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

export type Account = {
  id: string;
  label: string;
  icon: string;
  type: string | null;
  balance: number | null;
  readyToAssign: number | null;
  /**
   * What can really be assigned from this account: ready to assign minus unfunded savings and what its
   * owner still owes Joint. Derived in the app (see withAssignable), not from Notion.
   */
  assignable?: number | null;
  jointDue?: number | null;
  contributionPercent?: number | null;
};

export type PendingItem = {
  id: string;
  name: string;
  amount: number | null;
  categoryId: string | null;
  addedBy: string | null;
  date: string | null;
  claimedBy: "wife" | "husband" | null;
};

export type MonthlyCategoryTotal = {
  categoryId: string;
  total: number;
  accountId?: string | null;
};

export type MonthlySummary = {
  month?: string | null;
  start: string;
  end: string;
  totalAssigned: number;
  totalSpent: number;
  assignedByCategory: MonthlyCategoryTotal[];
  spentByCategory: MonthlyCategoryTotal[];
};

export type MonthlyPlanningSnapshot = {
  availablePool: number;
  assignedHousehold: number;
  assignedSavings: number;
  leftToAssign: number;
};

export type PlanningAllocationItem = {
  categoryId: string;
  name: string;
  icon: string | null;
  amount: number;
  spent?: number;
  available: number | null;
  lastMonthSpent: number | null;
  defaultAccount: string | null;
};

export type AppTab = "home" | "budget" | "history";
