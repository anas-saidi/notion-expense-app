const PROP_BUDGET_IN = "💰 budget (in)";
const PROP_BUDGET_OUT = "💰 budget (out)";
const PROP_ACCOUNT_IN = "🏦 account ( in )";
const PROP_ACCOUNT_OUT = "🏦 account ( out )";

export const mapTransactionPage = (page: any) => ({
  id: page.id,
  name: page.properties?.Name?.title?.[0]?.plain_text ?? "",
  amount: page.properties?.Amount?.number ?? 0,
  date: page.properties?.Date?.date?.start ?? "",
  category: page.properties?.Category?.relation?.[0]?.id ?? null,
  accountId: page.properties?.Account?.relation?.[0]?.id ?? null,
  type: page.properties?.Type?.select?.name ?? null,
  fromCategoryId: page.properties?.[PROP_BUDGET_OUT]?.relation?.[0]?.id ?? null,
  toCategoryId: page.properties?.[PROP_BUDGET_IN]?.relation?.[0]?.id ?? null,
  fromAccountId: page.properties?.[PROP_ACCOUNT_OUT]?.relation?.[0]?.id ?? null,
  toAccountId: page.properties?.[PROP_ACCOUNT_IN]?.relation?.[0]?.id ?? null,
});
