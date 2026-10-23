import { NextRequest } from "next/server";
import { GET as readAccounts } from "../../app/api/accounts/route";
import { GET as readCategories } from "../../app/api/categories/route";
import { GET as readMonthly } from "../../app/api/monthly-summary/route";
import { calculateContributionStatus } from "../../app/components/contribution-utils";
import { getAssignBalanceByScope, getCategoryScope, getJointAccountUnassigned } from "../../app/components/app-utils";
import { getPlanningSplit } from "../../app/components/month-plan-capacity";
import { billToday } from "../bills";
import type { Account, Category, BudgetScope } from "../../app/components/app-types";
export async function planningContext(request: NextRequest) {
  const month = billToday().slice(0, 7);
  const responses = await Promise.all([readAccounts(request), readCategories(new NextRequest(new URL("/api/categories?includeSnoozed=true&includeArchived=true", request.url))),
    readMonthly(new NextRequest(new URL(`/api/monthly-summary?month=${month}&includeTransactions=true&includeJointDebt=true`, request.url)))]);
  for (const response of responses) if (!response.ok) throw new Error("Could not verify planning capacity. Refresh and try again.");
  const [accountData, categoryData, monthly] = await Promise.all(responses.map(response => response.json()));
  const accounts: Account[] = accountData.accounts, categories: Category[] = categoryData.categories.filter((category: Category) => !category.archived);
  if (accounts.some(a => !a.type?.toLowerCase().includes("saving") && a.readyToAssign == null)) throw new Error("An account's available planning balance is unknown.");
  const contribution = calculateContributionStatus({ accounts, categories, transactions: monthly.transactions, debtTransactions: monthly.jointDebtTransactions, debtCategories: categoryData.categories, monthlySummary: monthly.summary });
  const assignable = getAssignBalanceByScope(accounts, contribution ? { anas: Math.max(0, contribution.anasPlan - contribution.anasActual), salma: Math.max(0, contribution.salmaPlan - contribution.salmaActual) } : undefined);
  const capacity = { ...assignable, joint: getJointAccountUnassigned(accounts) };
  if (request.nextUrl.searchParams.get("month") === month) {
    capacity.joint = assignable.joint;
    for (const item of monthly.summary.assignedByCategory) {
      const category = categories.find(c => c.id === item.categoryId);
      const scope = category && getCategoryScope(category, accounts) as BudgetScope | null;
      if (scope) capacity[scope] += item.total;
    }
  }
  return { capacity, split: getPlanningSplit(accounts) };
}
