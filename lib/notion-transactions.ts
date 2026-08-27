const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const NOTION_VERSION = "2022-06-28";

export type CreateExpenseInput = {
  name: string;
  amount: number;
  accountId: string;
  categoryId: string;
  date: string;
};

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

export async function createNotionExpense(token: string, input: CreateExpenseInput) {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { database_id: TRANSACTIONS_DB },
      properties: {
        Name: { title: [{ text: { content: input.name } }] },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        Category: { relation: [{ id: input.categoryId }] },
        Type: { select: { name: "Expense" } },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.message || "Failed to create transaction") as Error & {
      status?: number;
      full?: unknown;
    };
    error.status = response.status;
    error.full = data;
    throw error;
  }

  return {
    id: data.id,
    name: data.properties?.Name?.title?.[0]?.plain_text ?? input.name,
    amount: data.properties?.Amount?.number ?? input.amount,
    date: data.properties?.Date?.date?.start ?? input.date,
    categoryId: data.properties?.Category?.relation?.[0]?.id ?? input.categoryId,
    accountId: data.properties?.Account?.relation?.[0]?.id ?? input.accountId,
  };
}
