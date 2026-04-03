export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: string[];
  owner: string | null;
  defaultAccount: string | null;
  available: number | null;
  planned: number | null;
  lastMonthSpent: number | null;
  isTeamFund: boolean;
};

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string | null;
};

export type Account = {
  id: string;
  label: string;
  icon: string;
  type: string | null;
  balance: number | null;
  readyToAssign: number | null;
};

export type PendingItem = {
  id: string;
  name: string;
  amount: number | null;
  categoryId: string | null;
  addedBy: string | null;
  date: string | null;
};

export type MonthlyCategoryTotal = {
  categoryId: string;
  total: number;
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

export type PlanningStep = "close" | "income" | "budget" | "review";

export type MonthlyPlanningSnapshot = {
  availablePool: number;
  assignedHousehold: number;
  assignedSavings: number;
  leftToAssign: number;
};

export type PlanningIncomeItem = {
  id: string;
  name: string;
  accountId: string | null;
  amount: number;
  date: string;
};

export type PlanningIncomeStepState = {
  items: PlanningIncomeItem[];
  confirmedTotal: number;
  ready: boolean;
  source: "live" | "mock";
};

export type PlanningAllocationItem = {
  categoryId: string;
  name: string;
  icon: string | null;
  amount: number;
  available: number | null;
  lastMonthSpent: number | null;
};

export type CloseMonthStatus = "complete" | "attention" | "pending";

export type MonthCloseChecklistItem = {
  id: string;
  label: string;
  description: string;
  status: CloseMonthStatus;
};

export type MonthCloseMissingTransaction = {
  id: string;
  name: string;
  amount: number | null;
  date: string | null;
  addedBy: string | null;
  categoryId: string | null;
};

export type MonthCloseAccountSnapshot = {
  accountId: string;
  label: string;
  icon: string;
  type: string | null;
  currentBalance: number | null;
  lastReconciledBalance: number | null;
  lastReconciledAt: string | null;
  discrepancy: number | null;
  status: CloseMonthStatus;
};

export type MonthCloseSummary = {
  month: string;
  start: string;
  end: string;
  checklist: MonthCloseChecklistItem[];
  missingTransactions: MonthCloseMissingTransaction[];
  accounts: MonthCloseAccountSnapshot[];
  unresolvedCount: number;
  source: "live" | "mock";
};

export type CloseMonthStepState = {
  reviewed: boolean;
  unresolvedCount: number;
  needsAttention: boolean;
};

export type AppTab = "home" | "plan" | "pending" | "history";
