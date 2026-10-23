import { FUNDING_OPERATION, readText, SAVINGS_TARGET } from "./savings-funding";
import { PROP_INCOME_UNASSIGNED } from "./joint-income";
const PROP_BUDGET_IN = "💰 budget (in)";
const PROP_BUDGET_OUT = "💰 budget (out)";
const PROP_ACCOUNT_IN = "🏦 account ( in )";
const PROP_ACCOUNT_OUT = "🏦 account ( out )";

export const mapTransactionPage = (page: any) => ({
  savingsFundingOperation: readText(page.properties?.[FUNDING_OPERATION]) || undefined,
  savingsFundingTarget: page.properties?.[SAVINGS_TARGET]?.select?.name as "separate" | "shared" | undefined,
  id: page.id,
  createdAt: page.created_time,
  name: page.properties?.Name?.title?.[0]?.plain_text ?? "",
  amount: page.properties?.Amount?.number ?? 0,
  date: page.properties?.Date?.date?.start ?? "",
  category: page.properties?.Category?.relation?.[0]?.id ?? null,
  accountId: page.properties?.Account?.relation?.[0]?.id ?? null,
  incomeUse: page.properties?.[PROP_INCOME_UNASSIGNED]?.checkbox ? "unassigned" as const : "contributions" as const,
  type: page.properties?.Type?.select?.name ?? null,
  fromCategoryId: page.properties?.[PROP_BUDGET_OUT]?.relation?.[0]?.id ?? null,
  toCategoryId: page.properties?.[PROP_BUDGET_IN]?.relation?.[0]?.id ?? null,
  fromAccountId: page.properties?.[PROP_ACCOUNT_OUT]?.relation?.[0]?.id ?? null,
  toAccountId: page.properties?.[PROP_ACCOUNT_IN]?.relation?.[0]?.id ?? null,
});
