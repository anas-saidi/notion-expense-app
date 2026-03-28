export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: string[];
  defaultAccount: string | null;
  available: number | null;
  planned: number | null;
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
};

export type PendingItem = {
  id: string;
  name: string;
  amount: number | null;
  categoryId: string | null;
  addedBy: string | null;
  date: string | null;
};

export type AppTab = "home" | "pending" | "history";
