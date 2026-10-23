import { NextRequest } from "next/server";
import { POST as createCategory, PATCH as updateCategoryRoute } from "../../app/api/categories/route";
import { POST as monthlyPlan } from "../../app/api/monthly-planning/save/route";
import { POST as allocate, PATCH as updateFund, DELETE as deleteFund } from "../../app/api/monthly-planning/funds/route";
import { POST as savingsDeposit, DELETE as undoSavingsDeposit } from "../../app/api/savings-funding/route";
import { PATCH as updateBill, DELETE as deleteBill } from "../../app/api/bills/route";
import { POST as createPending, PATCH as claimPending, DELETE as deletePending } from "../../app/api/pending/route";
import { POST as reconcile } from "../../app/api/reconciliations/route";
import { PUT as restoreTransaction } from "../../app/api/transactions/route";
import { POST as savingsWithdrawal } from "../../app/api/transfer/route";

async function updateCategory(request: NextRequest) {
  const body = await request.json();
  if (body.clearSpendingPattern === true) body.spendingPattern = null;
  delete body.clearSpendingPattern;
  return updateCategoryRoute(new NextRequest(request.url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

// Explicit native commands; these reuse the established finance rules, never render web UI.
export const additionalHandlers = { createCategory, updateCategory, monthlyPlan, allocate, updateFund,
  deleteFund, savingsDeposit, undoSavingsDeposit, updateBill, deleteBill, createPending, claimPending,
  deletePending, reconcile, restoreTransaction, savingsWithdrawal };
