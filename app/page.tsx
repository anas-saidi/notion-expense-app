"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Fuse from "fuse.js";
import { AppShell } from "./components/AppShell";
import { HomeScreen } from "./components/HomeScreen";
import { InsightsScreen } from "./components/InsightsScreen";
import { CategoriesScreen } from "./components/CategoriesScreen";
import { MonthlyPlanningFlow } from "./components/MonthlyPlanningFlow";
import { AddTransactionSheet } from "./components/AddTransactionSheet";
import { AccountIncomeSheet } from "./components/AccountIncomeSheet";
import { AccountTransferSheet } from "./components/AccountTransferSheet";
import { CategoryDetailsSheet } from "./components/CategoryDetailsSheet";
import { CategoryManageSheet } from "./components/CategoryManageSheet";
import { ManageScreen } from "./components/ManageScreen";
import { AccountDetailsSheet } from "./components/AccountDetailsSheet";
import { RebalanceSheet } from "./components/RebalanceSheet";
import { MonthStartPlanner } from "./components/MonthStartPlanner";
import { JointAllocateSheet } from "./components/JointAllocateSheet";
import { Money } from "./components/Money";
import { PickerPopover } from "./components/PickerPopover";
import { TransactionDetailsSheet } from "./components/TransactionDetailsSheet";
import type { Account, BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./components/app-types";
import {
  categoryMatchesScope,
  categoryIdMatchesScope,
  evalExpr,
  expenseBalancePreview,
  fmtDate,
  getCategoryScope,
  getLeftToAssignByScope,
  getBalanceByScope,
  getJointAccountUnassigned,
  isSavingsAccount,
  monthBounds,
  shiftDate,
  today,
  transactionMatchesScope,
} from "./components/app-utils";

const LOADING_LINES = [
  "Warming up Notion...",
  "Sorting tiny receipts...",
  "Polishing your ledger...",
  "Counting coins quietly...",
];


const FALLBACK_ACCOUNTS: Account[] = [];

const formatMonthInput = (dateString: string) => dateString.slice(0, 7);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchApiJson<T>(url: string, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (response.ok) return data as T;
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await wait(900 * (attempt + 1));
      continue;
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  throw new Error("Request failed");
}

const isHouseholdCategory = (category: Category) => {
  return category.type.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("team") || normalized.includes("household");
  });
};

const isSavingsCategory = (category: Category) => {
  const types = category.type.map((value) => value.toLowerCase());
  if (types.some((value) => value.includes("team") || value.includes("household"))) return false;
  return types.some((value) => value.includes("saving") || value.includes("sinking") || value.includes("goal") || value.includes("fund"));
};

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 0.95, fontWeight: 800, color: "var(--text)" }}>{title}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{subtitle}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"wife" | "husband">("husband");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [categories, setCategories] = useState<Category[]>([]);
  const [frozenCategories, setFrozenCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(FALLBACK_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    start: "",
    end: "",
    totalAssigned: 0,
    totalSpent: 0,
    assignedByCategory: [],
    spentByCategory: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<"idle" | "updating" | "stale">("idle");
  const [budgetRefreshing, setBudgetRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [tab, setTab] = useState<"home" | "plan" | "budget" | "history">("home");
  const [budgetScope, setBudgetScope] = useState<BudgetScope>("joint");
  const [plannerMonth, setPlannerMonth] = useState(formatMonthInput(today()));
  const [nextMonthFunds, setNextMonthFunds] = useState<{ categoryId: string; planned: number }[]>([]);
  const [homeMonth, setHomeMonth] = useState(formatMonthInput(today()));
  const [plannerSummaryReady, setPlannerSummaryReady] = useState(false);
  const [plannerMonthlySummary, setPlannerMonthlySummary] = useState<MonthlySummary | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"Expense" | "Income">("Expense");
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<Category | null>(null);
  const [showRebalance, setShowRebalance] = useState(false);
  const [showJointAllocate, setShowJointAllocate] = useState(false);
  const [showManageScreen, setShowManageScreen] = useState(false);
  const [showMonthStartPlanner, setShowMonthStartPlanner] = useState(false);
  const [categoryManageMode, setCategoryManageMode] = useState<"fund" | "create" | null>(null);
  const [categoryManageCategory, setCategoryManageCategory] = useState<Category | null>(null);
  const [categoryManageDefaultType, setCategoryManageDefaultType] = useState<string | undefined>(undefined);
  const [incomeAccount, setIncomeAccount] = useState<Account | null>(null);
  const [transferAccount, setTransferAccount] = useState<Account | null>(null);
  const [detailsAccount, setDetailsAccount] = useState<Account | null>(null);
  const [homeSearch, setHomeSearch] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<{ amount: number; accountId: string } | null>(null);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [archivedTransaction, setArchivedTransaction] = useState<Transaction | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "archiving" | "archived" | "restoring" | "error">("idle");

  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today());
  const [catSearch, setCatSearch] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [draftOffer, setDraftOffer] = useState<{ amount: string; name: string; accountId: string; categoryId: string; date: string; scope: BudgetScope; timestamp: number } | null>(null);
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);

  const [microToast, setMicroToast] = useState<string | null>(null);
  const [lastUsedCatId, setLastUsedCatId] = useState("");
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<Array<{ month: string; totalSpent: number }>>([]);
  const [historyMonth, setHistoryMonth] = useState(formatMonthInput(today()));
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [corpus, setCorpus] = useState<{ description: string; categoryId: string }[]>([]);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);
  const initialAcctApplied = useRef(false);
  const initialCatApplied = useRef(false);
  const initialLoadStarted = useRef(false);
  const initialLoadComplete = useRef(false);
  const plannerMonthHydrated = useRef(false);
  const loadedPendingId = useRef<string | null>(null);
  const rebalanceReturnToAdd = useRef(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const balanceAnimRef = useRef<number | null>(null);
  const fuseRef = useRef<Fuse<{ description: string; categoryId: string }> | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Resolve identity from localStorage after hydration — runs only on client
  useEffect(() => {
    const saved = localStorage.getItem("identity");
    const savedScope = localStorage.getItem("budgetScope");
    if (saved === "wife" || saved === "husband") {
      setMode(saved);
      document.documentElement.dataset.mode = saved;
    } else {
      document.documentElement.dataset.mode = "husband";
    }
    if (savedScope === "joint" || savedScope === "anas" || savedScope === "salma") {
      setBudgetScope(savedScope);
    }
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode) document.documentElement.dataset.mode = mode;
  }, [mode]);

  const selectTheme = useCallback((next: "system" | "light" | "dark") => {
    setTheme(next);
    localStorage.setItem("theme", next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("budgetScope", budgetScope);
  }, [budgetScope, mounted]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, []);

  const showToast = (msg: string, timeout = 1400) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMicroToast(msg);
    toastTimerRef.current = setTimeout(() => setMicroToast(null), timeout);
  };

  const claimPendingItem = async (id: string, claimedBy: "wife" | "husband" | null) => {
    setPendingItems((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, claimedBy } : p);
      localStorage.setItem("pendingItems", JSON.stringify(updated));
      return updated;
    });
    try {
      const res = await fetch("/api/pending", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, claimedBy }),
      });
      if (!res.ok) {
        fetchPending();
        showToast("Failed to update claim");
      }
    } catch {
      fetchPending();
    }
  };

  const fetchTransactions = async () => {
    const data = await fetchApiJson<{ transactions?: Transaction[] }>("/api/transactions?page_size=100");
    const txns: Transaction[] = data.transactions ?? [];
    setTransactions(txns);
    const latestCat = txns.find(t => (!t.type || t.type === "Expense") && t.category)?.category;
    if (latestCat) setLastUsedCatId(latestCat);
  };

  const fetchHistoryTransactions = useCallback(async (month: string) => {
    setHistoryLoading(true);
    const { start, end } = monthBounds(`${month}-01`);
    const data = await fetch(`/api/transactions?start=${start}&end=${end}&page_size=100`).then(r => r.json());
    setHistoryTransactions(data.transactions ?? []);
    setHistoryLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== "history") return;
    fetchHistoryTransactions(historyMonth);
  }, [tab, historyMonth, fetchHistoryTransactions]);

  const fetchMonthlySummary = async (month?: string) => {
    const target = month ?? formatMonthInput(today());
    const { start, end } = monthBounds(`${target}-01`);
    const data = await fetchApiJson<{ summary?: MonthlySummary }>(`/api/monthly-summary?start=${start}&end=${end}`);
    setMonthlySummary({
      start,
      end,
      totalAssigned: data.summary?.totalAssigned ?? 0,
      totalSpent: data.summary?.totalSpent ?? 0,
      assignedByCategory: data.summary?.assignedByCategory ?? [],
      spentByCategory: data.summary?.spentByCategory ?? [],
    });
  };

  const fetchMonthlyTrend = async () => {
    const months = Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (4 - i));
      return d.toISOString().slice(0, 7);
    });
    const results = await Promise.allSettled(
      months.map(async (m) => {
        const { start, end } = monthBounds(`${m}-01`);
        const data = await fetch(`/api/monthly-summary?start=${start}&end=${end}`).then(r => r.json());
        return { month: m, totalSpent: data.summary?.totalSpent ?? 0 };
      })
    );
    setMonthlyTrend(results.flatMap(r => r.status === "fulfilled" ? [r.value] : []));
  };

  const fetchPending = async () => {
    try {
      const cached = localStorage.getItem("pendingItems");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setPendingItems(parsed);
      }
    } catch {}
    try {
      const res = await fetch("/api/pending");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setPendingItems(data.items);
        localStorage.setItem("pendingItems", JSON.stringify(data.items));
      }
    } catch {}
  };

  const fetchCategories = async () => {
    const data = await fetchApiJson<{ categories?: Category[] }>("/api/categories");
    const loadedCategories = data.categories ?? [];
    setCategories(loadedCategories);
    if (loadedCategories.length > 0 && !categoryId) setCategoryId(loadedCategories[0].id);
  };

  const fetchCategoryCatalog = async () => {
    const data = await fetchApiJson<{ categories?: Category[] }>("/api/categories?includeSnoozed=true");
    const catalog: Category[] = data.categories ?? [];
    const active = catalog.filter((category) => !category.snoozed && !category.archived);
    setCategories(active);
    setFrozenCategories(catalog.filter((category) => category.snoozed && !category.archived));
    if (active.length > 0 && !categoryId) setCategoryId(active[0].id);
  };

  const fetchAccounts = async () => {
    const data = await fetchApiJson<{ accounts?: Account[] }>("/api/accounts");
    setAccounts(data.accounts ?? []);
  };

  const fetchFrozenCategories = async () => {
    try {
      const data = await fetch("/api/categories?includeSnoozed=true").then((r) => r.json());
      const frozen = (data.categories ?? []).filter((category: Category) => category.snoozed && !category.archived);
      setFrozenCategories(frozen);
    } catch {
      setFrozenCategories([]);
    }
  };

  useEffect(() => {
    if (initialLoadStarted.current && loadAttempt === 0) return;
    initialLoadStarted.current = true;

    const loadLiveData = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        // Notion enforces a low request rate. Load the home dependencies in
        // sequence so a page refresh does not fan out into a burst of 429s.
        await fetchCategoryCatalog();
        await fetchAccounts();
        await fetchTransactions();
        await fetchPending();
        await fetchMonthlySummary(homeMonth);
        await fetchNextMonthFunds();
        setLastUpdatedAt(new Date());
      } catch (error) {
        console.error("[app] Failed to load live data:", error);
        setLoadError(error instanceof Error ? error.message : "Could not load financial data");
      } finally {
        initialLoadComplete.current = true;
        setLoading(false);
      }
    };

    void loadLiveData();
  }, [loadAttempt]);

  useEffect(() => {
    if (!mounted || !categories.length || !accounts.length) return;
    try {
      const raw = localStorage.getItem(`expenseDraft:v1:${mode}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || Date.now() - Number(parsed.timestamp) > 7 * 86400000) {
        localStorage.removeItem(`expenseDraft:v1:${mode}`);
        return;
      }
      setDraftOffer(parsed);
    } catch {}
  }, [mounted, mode, categories.length, accounts.length]);

  useEffect(() => {
    if (!mounted || !showAddModal || editingTransactionId || draftOffer) return;
    const payload = { version: 1, timestamp: Date.now(), amount, name, accountId, categoryId, date, scope: budgetScope };
    if (!amount && !name) return;
    try { localStorage.setItem(`expenseDraft:v1:${mode}`, JSON.stringify(payload)); } catch {}
  }, [mounted, showAddModal, editingTransactionId, draftOffer, amount, name, accountId, categoryId, date, budgetScope, mode]);

  // Refetch monthly summary whenever the viewed home month changes
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    fetchMonthlySummary(homeMonth); // eslint-disable-line react-hooks/exhaustive-deps
  }, [homeMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "history") return;
    void fetchMonthlyTrend();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the open account-details sheet pointed at the freshest account snapshot
  // instead of the one captured when the sheet was opened.
  useEffect(() => {
    if (!detailsAccount) return;
    const fresh = accounts.find((a) => a.id === detailsAccount.id);
    if (fresh && fresh !== detailsAccount) setDetailsAccount(fresh);
  }, [accounts, detailsAccount]);

  useEffect(() => {
    if (initialCatApplied.current) return;
    if (!lastUsedCatId || !categories.length) return;
    const cat = categories.find((c) => c.id === lastUsedCatId);
    if (!cat) return;
    initialCatApplied.current = true;
    setCategoryId(cat.id);
  }, [lastUsedCatId, categories]);

  useEffect(() => {
    if (plannerMonthHydrated.current) return;
    if (!monthlySummary.start) return;
    setPlannerMonth(formatMonthInput(monthlySummary.start));
    plannerMonthHydrated.current = true;
  }, [monthlySummary.start]);

  useEffect(() => {
    let cancelled = false;
    if (!showMonthStartPlanner || !plannerMonth) return;
    setPlannerSummaryReady(false);
    setPlannerMonthlySummary(null);
    const { start, end } = monthBounds(`${plannerMonth}-01`);

    fetch(`/api/monthly-summary?start=${start}&end=${end}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load planner summary");
        const data = await res.json();
        if (!cancelled) {
          setPlannerMonthlySummary({
            start,
            end,
            totalAssigned: data.summary?.totalAssigned ?? 0,
            totalSpent: data.summary?.totalSpent ?? 0,
            assignedByCategory: data.summary?.assignedByCategory ?? [],
            spentByCategory: data.summary?.spentByCategory ?? [],
          });
          setPlannerSummaryReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlannerMonthlySummary(null);
          setPlannerSummaryReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showMonthStartPlanner, plannerMonth]);

  useEffect(() => {
    if (initialAcctApplied.current) return;
    if (!accounts.length || !categories.length || !categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat?.defaultAccount) {
      initialAcctApplied.current = true;
      return;
    }
    const normId = (id: string) => id.replace(/-/g, "").toLowerCase();
    const acct = accounts.find((a) => normId(a.id) === normId(cat.defaultAccount!));
    if (acct) setAccountId(acct.id);
    initialAcctApplied.current = true;
  }, [categoryId, categories, accounts]);

  useEffect(() => {
    if (!categories.length) return;
    const current = categories.find((category) => category.id === categoryId);
    if (current && categoryMatchesScope(current, budgetScope)) return;
    const nextCategory = categories.find((category) => categoryMatchesScope(category, budgetScope));
    if (nextCategory) setCategoryId(nextCategory.id);
  }, [budgetScope, categories, categoryId]);

  useEffect(() => {
    const raw = localStorage.getItem("expenseCorpus");
    if (raw) {
      try {
        setCorpus(JSON.parse(raw));
      } catch {}
    } else {
      fetch("/api/transactions?page_size=50")
        .then((r) => r.json())
        .then((data) => {
          const entries = (data.transactions ?? [])
            .filter((t: Transaction) => t.name && t.category)
            .map((t: Transaction) => ({ description: t.name, categoryId: t.category as string }));
          setCorpus(entries);
          localStorage.setItem("expenseCorpus", JSON.stringify(entries));
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    fuseRef.current = new Fuse(corpus, {
      keys: ["description"],
      threshold: 0.35,
      minMatchCharLength: 3,
      includeScore: true,
    });
  }, [corpus]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingLineIdx((i) => (i + 1) % LOADING_LINES.length), 900);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const acct = accounts.find((a) => a.id === accountId);
    if (acct?.balance != null) setDisplayedBalance(acct.balance);
    else setDisplayedBalance(null);
  }, [accountId, accounts]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-picker-popover="true"]')) return;
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatPicker(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setShowAccountPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const animateBalance = (from: number, to: number) => {
    if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
    const duration = 700;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayedBalance(Math.round(from + (to - from) * ease));
      if (p < 1) balanceAnimRef.current = requestAnimationFrame(step);
    };
    balanceAnimRef.current = requestAnimationFrame(step);
  };

  const addPendingItem = async (data: { name: string; amount: number | null; categoryId: string | null; addedBy: string; date: string | null; claimedBy: "wife" | "husband" | null }) => {
    const optimistic: PendingItem = { id: `tmp-${Date.now()}`, ...data };
    setPendingItems((prev) => [...prev, optimistic]);
    try {
      const json = await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optimistic),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to save");
        return d;
      });
      setPendingItems((prev) => {
        const updated = prev.map((p) => (p.id === optimistic.id ? { ...p, id: json.id } : p));
        localStorage.setItem("pendingItems", JSON.stringify(updated));
        return updated;
      });
      showToast("Added to upcoming");
    } catch (e: unknown) {
      setPendingItems((prev) => prev.filter((p) => p.id !== optimistic.id));
      showToast(`Failed to save`);
      throw e;
    }
  };

  const loadPending = (item: PendingItem) => {
    setEditingTransactionId(null);
    setTransactionType("Expense");
    setName(item.name);
    if (item.amount !== null) setAmount(String(item.amount));
    if (item.date) setDate(item.date);
    if (item.categoryId) {
      const cat = categories.find((c) => c.id === item.categoryId);
      if (cat) selectCategory(cat);
    }
    loadedPendingId.current = item.id;
    setShowAddModal(true);
    showToast("Loaded into add form", 1200);
  };

  const editTransaction = (transaction: Transaction) => {
    if (transaction.type !== "Expense" && transaction.type != null) {
      setDetailsTransaction(transaction);
      return;
    }
    setEditingTransactionId(transaction.id);
    setTransactionType("Expense");
    setEditingOriginal({ amount: transaction.amount, accountId: transaction.accountId ?? "" });
    setName(transaction.name);
    setAmount(transaction.amount ? String(transaction.amount) : "");
    setDate(transaction.date || today());
    setSuggestedCatId(null);
    setCatSearch("");
    setShowDatePicker(false);
    setShowCatPicker(false);
    setShowAccountPicker(false);
    setCategoryId(transaction.category ?? "");
    setAccountId(transaction.accountId ?? "");
    loadedPendingId.current = null;
    setShowAddModal(true);
  };

  const dismissPending = async (id: string) => {
    setPendingItems((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem("pendingItems", JSON.stringify(updated));
      return updated;
    });
    fetch("/api/pending", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then((r) => {
        if (!r.ok) fetchPending();
      });
  };

  const refreshAffectedData = useCallback(async () => {
    setRefreshState("updating");
    const results = await Promise.allSettled([
      fetchTransactions(), fetchHistoryTransactions(historyMonth), fetchCategoryCatalog(), fetchAccounts(), fetchMonthlySummary(homeMonth),
    ]);
    if (results.some(result => result.status === "rejected")) {
      setRefreshState("stale");
      throw new Error("Some balances or activity could not be refreshed");
    }
    setRefreshState("idle");
    setLastUpdatedAt(new Date());
  }, [historyMonth, homeMonth, fetchHistoryTransactions]);

  const deleteTransaction = async (id: string) => {
    const transaction = historyTransactions.find(item => item.id === id) ?? transactions.find(item => item.id === id);
    if (!transaction) return false;
    setArchiveStatus("archiving");
    try {
      const response = await fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not archive transaction");
      setTransactions(prev => prev.filter(item => item.id !== id));
      setHistoryTransactions(prev => prev.filter(item => item.id !== id));
      setArchivedTransaction(transaction);
      setArchiveStatus("archived");
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => { setArchivedTransaction(null); setArchiveStatus("idle"); }, 10000);
      void refreshAffectedData().catch(error => showToast(error.message));
      return true;
    } catch (error) {
      setArchiveStatus("error");
      showToast(error instanceof Error ? error.message : "Could not archive transaction");
      return false;
    }
  };

  const restoreArchivedTransaction = async () => {
    const transaction = archivedTransaction;
    if (!transaction) return;
    setArchiveStatus("restoring");
    try {
      const response = await fetch("/api/transactions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: transaction.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not restore transaction");
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setArchivedTransaction(null);
      setArchiveStatus("idle");
      await refreshAffectedData();
    } catch (error) {
      setArchiveStatus("error");
      showToast(error instanceof Error ? error.message : "Could not restore transaction");
    }
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const plannerUsesFallbackData =
    !plannerSummaryReady || plannerMonth !== formatMonthInput(today());

  const readyToAssignByScope = useMemo(() => getLeftToAssignByScope(accounts), [accounts]);
  const balanceByScope = useMemo(() => getBalanceByScope(accounts), [accounts]);
  const jointUnassigned = useMemo(() => getJointAccountUnassigned(accounts), [accounts]);
  const savingPool = useMemo(
    () => accounts.filter(isSavingsAccount).reduce((sum, a) => sum + (a.readyToAssign ?? 0), 0),
    [accounts],
  );

  // Derive which scopes have been planned for next month (based on existing fund records)
  const plannedScopes = useMemo((): Record<"joint" | "anas" | "salma", boolean> => {
    if (!nextMonthFunds.length) return { joint: false, anas: false, salma: false };
    const fundedIds = new Set(nextMonthFunds.filter((f) => f.planned > 0).map((f) => f.categoryId));
    const all = [...categories, ...frozenCategories];
    return {
      joint: all.filter((c) => getCategoryScope(c) === "joint").some((c) => fundedIds.has(c.id)),
      anas:  all.filter((c) => getCategoryScope(c) === "anas").some((c) => fundedIds.has(c.id)),
      salma: all.filter((c) => getCategoryScope(c) === "salma").some((c) => fundedIds.has(c.id)),
    };
  }, [nextMonthFunds, categories, frozenCategories]);

  // Planning is always for the NEXT month (we close the current month and plan the upcoming one)
  const monthStartPlannerMonth = useMemo(() => {
    const [y, m] = homeMonth.split("-").map(Number);
    const d = new Date(y, m, 1); // month m = next month (JS months 0-indexed)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [homeMonth]);
  // DEBUG PRINTS for spent on team categories
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Find all team (household) categories
    const teamCategoryIds = new Set(categories.filter((c) => c.isTeamFund).map((c) => c.id));
    // Map accountId to label
    const accountLabelById = new Map(accounts.map((a) => [a.id, a.label.toLowerCase()]));
    let husbandSpent = 0;
    let wifeSpent = 0;
    for (const txn of transactions) {
      if (!txn.category || !teamCategoryIds.has(txn.category)) continue;
      const label = txn.accountId ? accountLabelById.get(txn.accountId) ?? "" : "";
      if (label.includes("hubb")) husbandSpent += txn.amount ?? 0;
      if (label.includes("wife")) wifeSpent += txn.amount ?? 0;
    }

  }, [accounts, categories, transactions]);

  const selectCategory = (cat: Category) => {
    setCategoryId(cat.id);
    setLastUsedCatId(cat.id);
    if (cat.defaultAccount) {
      const normId = (id: string) => id.replace(/-/g, "").toLowerCase();
      const acct = accounts.find((a) => normId(a.id) === normId(cat.defaultAccount!));
      if (acct) setAccountId(acct.id);
    }
    setShowCatPicker(false);
    setCatSearch("");
  };

  const openCategoryDetails = (cat: Category) => {
    setDetailsCategory(cat);
    setShowCategoryDetails(true);
  };

  const openFundCategory = (cat: Category) => {
    selectCategory(cat);
    setCategoryManageCategory(cat);
    setCategoryManageMode("fund");
  };

  const availableCategoryTypes = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const cat of categories) {
      const t = cat.type[0];
      if (t && !seen.has(t)) { seen.add(t); result.push(t); }
    }
    return result;
  }, [categories]);

  const openNewCategory = (defaultType?: string) => {
    setCategoryManageCategory(null);
    setCategoryManageDefaultType(defaultType);
    setCategoryManageMode("create");
  };

  const refreshBudgetData = async (message?: string) => {
    setBudgetRefreshing(true);
    await Promise.allSettled([
      fetchCategories(),
      fetchFrozenCategories(),
      fetchMonthlySummary(homeMonth),
      fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? [])),
    ]);
    setBudgetRefreshing(false);
    if (message) showToast(message, 1500);
  };

  const refreshAccountsData = (message?: string) => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
    fetchMonthlySummary(homeMonth);
    if (message) showToast(message, 1500);
  };

  const fetchNextMonthFunds = async () => {
    try {
      const data = await fetch(`/api/monthly-planning/funds?month=${monthStartPlannerMonth}`).then((r) => r.json());
      setNextMonthFunds(data.funds ?? []);
    } catch {
      setNextMonthFunds([]);
    }
  };

  const openMonthlyPlan = () => {
    setShowMonthStartPlanner(true);
  };

  const reviveCategory = async (category: Category) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, snoozed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revive category");
      refreshBudgetData(`${category.name} revived`);
      setCategoryManageCategory({ ...category, snoozed: false });
      setCategoryManageMode("fund");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to revive");
    }
  };

  const freezeCategory = async (category: Category) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, snoozed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to freeze category");
      refreshBudgetData(`${category.name} frozen`);
      if (selectedCat?.id === category.id) setShowCategoryDetails(false);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to freeze");
    }
  };

  const filteredCats = categories
    .filter((c) => categoryMatchesScope(c, budgetScope))
    .filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.id === lastUsedCatId) return -1;
      if (b.id === lastUsedCatId) return 1;
      return 0;
    });

  const filteredAccounts = accounts;

  const homeCategories = categories
    .filter((c) => {
      const q = homeSearch.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.type.some((t) => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (a.id === lastUsedCatId) return -1;
      if (b.id === lastUsedCatId) return 1;
      return a.name.localeCompare(b.name);
    });

  const getMonthlySummaryForScope = useCallback((scope: BudgetScope): MonthlySummary => {
    const accountLabel = (entry: { accountId?: string | null }) => {
      if (!entry.accountId) return "";
      return (accounts.find(a => a.id === entry.accountId)?.label ?? "").toLowerCase();
    };

    const assignmentMatchesScope = (entry: { categoryId: string; accountId?: string | null }) => {
      const label = accountLabel(entry);
      // Savings accounts are never part of operational planned budget
      if (label.includes("saving")) return false;
      // Primary: use account label (ground truth for who made the assignment)
      if (label.includes("hubb")) return scope === "anas";
      if (label.includes("wife")) return scope === "salma";
      if (label.includes("joined")) return scope === "joint";
      // Fallback: use category scope when account is unknown
      const cat = categories.find(c => c.id === entry.categoryId);
      if (!cat) return scope === "joint";
      const catScope = getCategoryScope(cat);
      return catScope === scope;
    };

    const assignedByCategory = monthlySummary.assignedByCategory.filter(assignmentMatchesScope);

    const categoryIds = new Set(
      categories.filter(c => categoryMatchesScope(c, scope)).map(c => c.id),
    );
    const spentByCategory = monthlySummary.spentByCategory.filter((entry) => categoryIds.has(entry.categoryId));

    return {
      ...monthlySummary,
      totalAssigned: assignedByCategory.reduce((sum, entry) => sum + entry.total, 0),
      totalSpent: spentByCategory.reduce((sum, entry) => sum + entry.total, 0),
      assignedByCategory,
      spentByCategory,
    };
  }, [categories, accounts, monthlySummary]);

  const scopedMonthlySummary = useMemo(() => {
    return getMonthlySummaryForScope(budgetScope);
  }, [budgetScope, getMonthlySummaryForScope]);

  const walletMonthlySummaries = useMemo<Partial<Record<BudgetScope, MonthlySummary>>>(() => {
    return {
      joint: getMonthlySummaryForScope("joint"),
      anas: getMonthlySummaryForScope("anas"),
      salma: getMonthlySummaryForScope("salma"),
    };
  }, [getMonthlySummaryForScope]);

  const leftToSpendByScope = useMemo<Record<BudgetScope, number>>(() => {
    const sum = (scope: BudgetScope) =>
      categories
        .filter(c => categoryMatchesScope(c, scope) && !isSavingsCategory(c))
        .reduce((s, c) => s + (c.available ?? 0), 0);
    return { joint: sum("joint"), anas: sum("anas"), salma: sum("salma") };
  }, [categories]);

  const scopedTransactions = useMemo(
    () => transactions.filter((transaction) => transactionMatchesScope(transaction, categories, budgetScope, accounts)),
    [budgetScope, categories, transactions, accounts],
  );

  const scopedHistoryTransactions = useMemo(
    () => historyTransactions.filter(t => transactionMatchesScope(t, categories, budgetScope, accounts)),
    [historyTransactions, categories, budgetScope, accounts],
  );

  const scopedPendingItems = useMemo(
    () => pendingItems.filter((item) => categoryIdMatchesScope(item.categoryId, categories, budgetScope)),
    [budgetScope, categories, pendingItems],
  );

  // Joint contribution status — single source of truth for the Home partner cards.
  // Uses the current month's transactions already loaded for the Home screen.
  const contribStatus = useMemo(() => {
    if (budgetScope !== "joint" || !accounts.length) return null;
    const jointSummary = getMonthlySummaryForScope("joint");
    const totalPlanned = jointSummary.totalAssigned;
    if (totalPlanned <= 0) return null;

    const acctLabel = (id: string | null | undefined) =>
      id ? (accounts.find(a => a.id === id)?.label ?? "").toLowerCase() : "";

    const anasAcc  = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("hubb"));
    const salmaAcc = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("wife"));
    const anasContribPct  = anasAcc?.contributionPercent  ?? null;
    const salmaContribPct = salmaAcc?.contributionPercent ?? null;
    if (anasContribPct == null && salmaContribPct == null) return null;

    // Joint scope includes:
    // personal-account expenses on joint categories + all category-less transfers
    const jointTxns = transactions.filter(
      (transaction) => transaction.date?.startsWith(homeMonth) && transactionMatchesScope(transaction, categories, "joint", accounts),
    );
    const expenseTxns = jointTxns.filter(t => t.category && (!t.type || t.type === "Expense"));

    let anasPocket = 0, salmaPocket = 0, sharedSpend = 0;
    for (const t of expenseTxns) {
      const label = acctLabel(t.accountId);
      if (label.includes("hubb")) anasPocket += t.amount;
      else if (label.includes("wife")) salmaPocket += t.amount;
      else sharedSpend += t.amount;
    }

    const joinedAccId = accounts.find(a => a.label.toLowerCase().includes("joined"))?.id;
    let anasFunded = 0, salmaFunded = 0;
    for (const t of jointTxns) {
      if (t.type !== "Transfer") continue;
      if (!t.toAccountId || t.toAccountId !== joinedAccId) continue;
      const fromLabel = acctLabel(t.fromAccountId);
      if (fromLabel.includes("hubb"))      anasFunded  += t.amount;
      else if (fromLabel.includes("wife")) salmaFunded += t.amount;
    }

    const joinedAcc = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("joined"));
    const joinedBalance = Math.max(0, joinedAcc?.balance ?? 0);
    const organicBalance = Math.max(0, joinedBalance - anasFunded - salmaFunded + sharedSpend);
    const needFromPersonal = Math.max(0, totalPlanned - organicBalance);

    const anasPlan  = anasContribPct  != null ? anasContribPct  * needFromPersonal : 0;
    const salmaPlan = salmaContribPct != null ? salmaContribPct * needFromPersonal : 0;

    return {
      anasPlan, salmaPlan,
      anasActual: anasPocket + anasFunded,
      salmaActual: salmaPocket + salmaFunded,
      anasDirectSpend: anasPocket,
      salmaDirectSpend: salmaPocket,
      anasTransferred: anasFunded,
      salmaTransferred: salmaFunded,
    };
  }, [budgetScope, accounts, transactions, homeMonth, categories, getMonthlySummaryForScope]);

  const selectedDateLabel =
    date === today() ? "Today" :
    date === shiftDate(today(), -1) ? "Yesterday" :
    date === shiftDate(today(), 1) ? "Tomorrow" :
    fmtDate(date);

  const amountAfterBalance = displayedBalance !== null && amount && evalExpr(amount) > 0
    ? editingOriginal
      ? expenseBalancePreview({ currentAccountId: accountId, currentBalance: displayedBalance, originalAccountId: editingOriginal.accountId, originalAmount: editingOriginal.amount, editedAmount: evalExpr(amount) })
      : transactionType === "Income"
        ? displayedBalance + evalExpr(amount)
        : displayedBalance - evalExpr(amount)
    : null;

  const suggestCategory = (query: string) => {
    if (!fuseRef.current || query.length < 3) {
      setSuggestedCatId(null);
      return;
    }
    const results = fuseRef.current.search(query);
    if (!results.length) {
      setSuggestedCatId(null);
      return;
    }
    const tally: Record<string, { weight: number; count: number }> = {};
    for (const result of results) {
      const catId = result.item.categoryId;
      const weight = 1 - (result.score ?? 1);
      if (!tally[catId]) tally[catId] = { weight: 0, count: 0 };
      tally[catId].weight += weight;
      tally[catId].count += 1;
    }
    const best = Object.entries(tally).filter(([, value]) => value.count >= 2).sort((a, b) => b[1].weight - a[1].weight)[0];
    setSuggestedCatId(best ? best[0] : null);
  };

  const submit = async () => {
    if (!amount || !name || !accountId || (transactionType === "Expense" && !categoryId)) return;
    setStatus("saving");
    setErrorMsg("");
    const isEditing = Boolean(editingTransactionId);
    try {
      const payload = { name, amount: evalExpr(amount), accountId, categoryId, date };
      const endpoint = isEditing ? "/api/transactions" : transactionType === "Income" ? "/api/monthly-income" : "/api/expense";
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingTransactionId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setStatus("success");
      showToast(isEditing ? "Transaction updated" : "Saved", 1500);

      if (transactionType === "Expense") {
        const newEntry = { description: name.trim(), categoryId };
        setCorpus((prev) => {
          const updated = [...prev, newEntry].slice(-100);
          localStorage.setItem("expenseCorpus", JSON.stringify(updated));
          return updated;
        });
      }

      const expAmt = evalExpr(amount);
      if (!isEditing && displayedBalance !== null) animateBalance(displayedBalance, displayedBalance + (transactionType === "Income" ? expAmt : -expAmt));
      fetchTransactions();
      fetchMonthlySummary(homeMonth);
      fetchCategories();
      fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
      // Re-fetch categories after a short delay — Notion computed properties (formulas/rollups)
      // may not reflect the new transaction immediately.
      setTimeout(() => {
        fetchCategories();
        fetchMonthlySummary(homeMonth);
      }, 1500);

      if (loadedPendingId.current) {
        dismissPending(loadedPendingId.current);
        loadedPendingId.current = null;
      }

      if (!isEditing) {
        try { localStorage.removeItem(`expenseDraft:v1:${mode}`); } catch {}
        setDraftOffer(null);
      }

      setAmount("");
      setName("");
      setEditingTransactionId(null);
      setEditingOriginal(null);
      setSuggestedCatId(null);
      setDate(today());
      if (isEditing) {
        setShowAddModal(false);
        setStatus("idle");
      } else {
        setTimeout(() => setStatus("idle"), 2000);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  // Not yet mounted: server and first client render must match — show a neutral shell
  if (!mounted || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          {mounted && (
            <p style={{ fontSize: 11, letterSpacing: 0.2, color: "var(--muted)", fontWeight: 600, animation: "fadeUp 0.2s ease both" }}>
              {LOADING_LINES[loadingLineIdx]}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (loadError && !categories.length && !accounts.length) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)" }}><section role="alert" style={{ maxWidth: 420, padding: 20, borderRadius: "var(--radius-card)", background: "var(--surface)", boxShadow: "var(--elevation-card)" }}><h1 style={{ fontSize: 22 }}>Could not load your finances</h1><p style={{ margin: "10px 0 18px", color: "var(--text2)" }}>No balances were replaced. Check the connection and try again.</p><button type="button" onClick={() => setLoadAttempt(value => value + 1)} style={{ minHeight: 48, padding: "0 18px", border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800 }}>Retry</button></section></main>;
  }

  const parsedAmount = amount ? evalExpr(amount) : 0;
  const isEditingTransaction = Boolean(editingTransactionId);
  const categoryUnfunded = transactionType === "Expense" && !isEditingTransaction && !!(selectedCat && selectedCat.available !== null && selectedCat.available === 0);
  const categoryOverBudget = transactionType === "Expense" && !isEditingTransaction && !!(selectedCat && selectedCat.available !== null && selectedCat.available > 0 && parsedAmount > selectedCat.available);
  const canSubmit = Boolean(amount && parsedAmount > 0 && name.trim() && accountId && (transactionType === "Income" || categoryId) && status === "idle" && !categoryUnfunded && !categoryOverBudget);
  const suggestedCategory = suggestedCatId ? categories.find((c) => c.id === suggestedCatId) : undefined;

  return (
    <AppShell
      tab={tab}
      pendingCount={scopedPendingItems.length}
      onTabChange={(t) => { setTab(t); setShowManageScreen(false); }}
      onOpenAdd={() => {
        setEditingTransactionId(null);
        setTransactionType("Expense");
        setShowAddModal(true);
      }}
      onOpenManage={() => setShowManageScreen(true)}
      budgetScope={budgetScope}
      onBudgetScopeChange={setBudgetScope}
      personalScope={mode === "wife" ? "salma" : "anas"}
      onBudgetSearch={() => window.dispatchEvent(new Event("open-budget-search"))}
      onInsightsSearch={() => window.dispatchEvent(new Event("open-insights-search"))}
      onBudgetRebalance={() => setShowRebalance(true)}
      theme={theme}
      onSelectTheme={selectTheme}
      toast={microToast}
      showAddButton={tab !== "plan" && !showManageScreen}
      immersive={tab === "plan"}
    >
      {refreshState !== "idle" && (
        <div role="status" aria-live="polite" style={refreshStatusStyle}>
          {refreshState === "updating" ? "Updating" : <>Could not refresh · <button type="button" onClick={() => void refreshAffectedData().catch(error => showToast(error.message))}>Retry</button></>}
        </div>
      )}
      {showManageScreen && (
        <ManageScreen
          accounts={accounts}
          budgetScope={budgetScope}
          onClose={() => setShowManageScreen(false)}
          onOpenDetails={setDetailsAccount}
        />
      )}

      <MonthStartPlanner
        open={showMonthStartPlanner}
        onClose={() => setShowMonthStartPlanner(false)}
        onComplete={() => {
          refreshBudgetData();
          fetchNextMonthFunds(); // eslint-disable-line react-hooks/exhaustive-deps
        }}
        categories={categories.filter((c) => !c.snoozed && !c.archived)}
        frozenCategories={frozenCategories}
        accounts={accounts}
        planningMonth={monthStartPlannerMonth}
        readyToAssignByScope={readyToAssignByScope}
        savingPool={savingPool}
        onOpenNewCategory={openNewCategory}
      />

      {tab === "home" && (
        <HomeScreen
          categories={homeCategories}
          selectedCategoryId={categoryId}
          search={homeSearch}
          onSearchChange={setHomeSearch}
          onSelectCategory={selectCategory}
          onOpenCategoryDetails={openCategoryDetails}
          onOpenAdd={() => {
            setEditingTransactionId(null);
            setShowAddModal(true);
          }}
          onOpenPlan={openMonthlyPlan}
          onOpenRebalance={() => setShowRebalance(true)}
          onOpenBudgetTab={() => setTab("budget")}
          onFundCategory={openFundCategory}
          contribStatus={contribStatus}
          monthlySummary={scopedMonthlySummary}
          walletSummaries={walletMonthlySummaries}
          leftToSpendByScope={leftToSpendByScope}
          balanceByScope={balanceByScope}
          readyToAssignByScope={readyToAssignByScope}
          budgetScope={budgetScope}
          onBudgetScopeChange={setBudgetScope}
          homeMonth={homeMonth}
          onHomeMonthChange={setHomeMonth}
          plannedScopes={plannedScopes}
          transactions={scopedTransactions}
          pendingItems={scopedPendingItems}
          onOpenHistory={() => setTab("history")}
          onClickTransaction={editTransaction}
          jointUnassigned={jointUnassigned}
          onOpenJointAllocate={() => setShowJointAllocate(true)}
        />
      )}

      <JointAllocateSheet
        open={showJointAllocate}
        onClose={() => setShowJointAllocate(false)}
        onComplete={() => refreshBudgetData("Joint balance allocated")}
        accounts={accounts}
        categories={categories}
        assignedByCategory={monthlySummary.assignedByCategory}
        selectedMonth={homeMonth}
        jointUnassigned={jointUnassigned}
      />

      {<MonthlyPlanningFlow
        open={tab === "plan"}
        selectedMonth={plannerMonth}
        onSelectedMonthChange={setPlannerMonth}
        onCancel={() => setTab("home")}
        onComplete={() => {
          refreshBudgetData("Plan saved");
          fetchNextMonthFunds(); // eslint-disable-line react-hooks/exhaustive-deps
        }}
        onOpenAddTransaction={({ accountId: nextAccountId, amount: nextAmount, name: nextName }) => {
          setEditingTransactionId(null);
          setAccountId(nextAccountId);
          setAmount(String(nextAmount));
          setName(nextName ?? "");
          setDate(today());
          setShowAddModal(true);
        }}
        accounts={accounts}
        categories={categories}
        budgetScope={budgetScope}
        availablePool={readyToAssignByScope[budgetScope] ?? 0}
        assignedByCategory={plannerMonthlySummary?.assignedByCategory ?? []}
        isUsingFallbackData={plannerUsesFallbackData}
      />}

      {tab === "budget" && (
        <CategoriesScreen
          categories={categories}
          frozenCategories={frozenCategories}
          accounts={accounts}
          monthlySummary={monthlySummary}
          homeMonth={homeMonth}
          budgetScope={budgetScope}
          selectedCategoryId={categoryId}
          onSelectCategory={selectCategory}
          onOpenCategoryDetails={openCategoryDetails}
          onOpenRebalance={() => setShowRebalance(true)}
          onFreezeCategory={freezeCategory}
          onReviveCategory={reviveCategory}
          onFundCategory={openFundCategory}
          onOpenNewCategory={openNewCategory}
          loading={budgetRefreshing || refreshState === "updating"}
        />
      )}

      {tab === "history" && (
        <InsightsScreen
          transactions={historyTransactions}
          categories={categories}
          accounts={accounts}
          budgetScope={budgetScope}
          insightsMonth={historyMonth}
          onInsightsMonthChange={setHistoryMonth}
          transactionsLoading={historyLoading}
          onClickTransaction={editTransaction}
          onDeleteTransaction={deleteTransaction}
        />
      )}

      <AddTransactionSheet
        open={showAddModal}
        mode={mode}
        amount={amount}
        name={name}
        date={date}
        catSearch={catSearch}
        showDatePicker={showDatePicker}
        showCatPicker={showCatPicker}
        showAccountPicker={showAccountPicker}
        status={status}
        errorMsg={errorMsg}

        selectedDateLabel={selectedDateLabel}
        selectedCat={selectedCat}
        suggestedCategory={suggestedCategory}
        selectedAccount={selectedAccount}
        filteredCats={filteredCats}
        filteredAccounts={filteredAccounts}
        lastUsedCatId={lastUsedCatId}
        displayedBalance={displayedBalance}
        amountAfterBalance={amountAfterBalance}
        parsedAmount={parsedAmount}
        categoryUnfunded={categoryUnfunded}
        categoryOverBudget={categoryOverBudget}
        canSubmit={canSubmit}
        allCategories={categories.filter(c => !isSavingsCategory(c))}
        modeVariant={editingTransactionId ? "edit" : "create"}
        transactionType={transactionType}
        onTransactionTypeChange={(type) => {
          setTransactionType(type);
          setSuggestedCatId(null);
          setShowCatPicker(false);
          setStatus("idle");
          setErrorMsg("");
        }}
        onOpenRebalance={() => {
          rebalanceReturnToAdd.current = true;
          setShowAddModal(false);
          setShowRebalance(true);
        }}
        onQuickFund={async (sourceCategoryId, amount) => {
          try {
            const res = await fetch("/api/transfer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fromCategoryId: sourceCategoryId,
                toCategoryId: categoryId,
                amount,
                date: today(),
                note: "Quick fund",
              }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error ?? "Transfer failed");
            }
            // Wait for Notion computed properties to propagate before re-fetching
            await new Promise<void>(resolve => setTimeout(resolve, 1500));
            await fetchCategories();
            fetchMonthlySummary(homeMonth);
          } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : "Transfer failed");
            throw e;
          }
        }}
        onClose={() => {
          if (editingTransactionId) {
            setAmount("");
            setName("");
            setSuggestedCatId(null);
            setDate(today());
          }
          setShowAddModal(false);
          setEditingTransactionId(null);
          setEditingOriginal(null);
          setStatus("idle");
        }}
        onAmountChange={(value) => {
          const cleaned = value.replace(/[^0-9.+\-*/\s]/g, "");
          setAmount(cleaned);
        }}
        onNameChange={(value) => {
          setName(value);
          if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
          suggestTimerRef.current = setTimeout(() => suggestCategory(value.trim()), 200);
        }}
        onToggleDatePicker={() => {
          setShowDatePicker((v) => !v);
          setShowCatPicker(false);
          setShowAccountPicker(false);
        }}
        onToggleCatPicker={() => {
          setShowCatPicker((v) => !v);
          setShowDatePicker(false);
          setShowAccountPicker(false);
        }}
        onToggleAccountPicker={() => {
          setShowAccountPicker((v) => !v);
          setShowDatePicker(false);
          setShowCatPicker(false);
        }}
        onSelectDate={(value) => {
          setDate(value);
          setShowDatePicker(false);
        }}
        onSelectCategory={selectCategory}
        onSelectAccount={(id) => {
          setAccountId(id);
          setShowAccountPicker(false);
        }}
        onCatSearchChange={setCatSearch}
        onSubmit={submit}
        dateRef={dateRef}
        catRef={catRef}
        accountRef={accountRef}
      />

      <TransactionDetailsSheet
        transaction={detailsTransaction}
        accounts={accounts}
        categories={categories}
        onClose={() => setDetailsTransaction(null)}
      />

      <CategoryDetailsSheet
        open={showCategoryDetails}
        category={detailsCategory}
        month={(monthlySummary.start || today()).slice(0, 7)}
        onClose={() => setShowCategoryDetails(false)}
        onOpenAdd={() => {
          if (detailsCategory) selectCategory(detailsCategory);
          setEditingTransactionId(null);
          setTransactionType("Expense");
          setShowCategoryDetails(false);
          setShowAddModal(true);
        }}
        onOpenFund={() => {
          if (detailsCategory) openFundCategory(detailsCategory);
        }}
        onFreeze={detailsCategory ? () => freezeCategory(detailsCategory) : undefined}
      />

      <CategoryManageSheet
        open={categoryManageMode !== null}
        mode={categoryManageMode ?? "fund"}
        category={categoryManageCategory}
        month={homeMonth}
        accounts={accounts}
        defaultScope={budgetScope}
        availableTypes={availableCategoryTypes}
        defaultType={categoryManageDefaultType}
        onClose={() => setCategoryManageMode(null)}
        onSuccess={refreshBudgetData}
        zIndex={95}
      />

      <AccountDetailsSheet
        open={detailsAccount !== null}
        account={detailsAccount}
        transactions={transactions}
        categories={categories}
        homeMonth={homeMonth}
        onClose={() => setDetailsAccount(null)}
        onMove={(acct) => { setDetailsAccount(null); setTransferAccount(acct); }}
        onIncome={(acct) => { setDetailsAccount(null); setIncomeAccount(acct); }}
        onReconcileSuccess={(msg) => { refreshAccountsData(msg); }}
        onTransactionsChanged={() => { fetchTransactions(); refreshBudgetData(); }}
      />

      <AccountIncomeSheet
        open={incomeAccount !== null}
        account={incomeAccount}
        onClose={() => setIncomeAccount(null)}
        onSuccess={refreshAccountsData}
      />

      <AccountTransferSheet
        open={transferAccount !== null}
        account={transferAccount}
        accounts={accounts}
        onClose={() => setTransferAccount(null)}
        onSuccess={refreshAccountsData}
      />

      <RebalanceSheet
        open={showRebalance}
        onClose={() => {
          setShowRebalance(false);
          rebalanceReturnToAdd.current = false;
        }}
        categories={categories}
        accounts={accounts}
        homeMonth={homeMonth}
        monthlySummary={monthlySummary}
        budgetScope={budgetScope}
        readyToAssignByScope={readyToAssignByScope}
        jointUnassigned={jointUnassigned}
        onSuccess={() => {
          refreshBudgetData("Rebalance applied");
          if (rebalanceReturnToAdd.current) {
            rebalanceReturnToAdd.current = false;
            setShowAddModal(true);
          }
        }}
      />

      {archivedTransaction && (
        <div role="status" aria-live="polite" style={undoNoticeStyle}>
          <span>{archiveStatus === "restoring" ? "Restoring transaction…" : archiveStatus === "error" ? "Restore failed; transaction remains archived." : "Transaction archived."}</span>
          <button type="button" disabled={archiveStatus === "restoring"} onClick={restoreArchivedTransaction} style={undoButtonStyle}>
            {archiveStatus === "error" ? "Retry" : "Undo"}
          </button>
        </div>
      )}

      {draftOffer && !showAddModal && (
        <div role="dialog" aria-modal="true" aria-label="Restore expense draft" style={draftOverlayStyle}>
          <div style={draftDialogStyle}>
            <h2 style={{ fontSize: 20 }}>Restore unfinished expense?</h2>
            <p style={{ color: "var(--text2)", lineHeight: 1.45 }}>A draft from {new Date(draftOffer.timestamp).toLocaleDateString()} is available. It will not be submitted automatically.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { try { localStorage.removeItem(`expenseDraft:v1:${mode}`); } catch {} setDraftOffer(null); }} style={draftSecondaryButtonStyle}>Discard</button>
              <button type="button" onClick={() => { setAmount(draftOffer.amount); setName(draftOffer.name); setAccountId(accounts.some(a => a.id === draftOffer.accountId) ? draftOffer.accountId : ""); setCategoryId(categories.some(c => c.id === draftOffer.categoryId) ? draftOffer.categoryId : ""); setDate(draftOffer.date || today()); setBudgetScope(draftOffer.scope); setDraftOffer(null); setShowAddModal(true); }} style={draftPrimaryButtonStyle}>Restore</button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}


const ghostActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};

const undoNoticeStyle: CSSProperties = {
  position: "fixed", left: 16, right: 16, bottom: "calc(92px + env(safe-area-inset-bottom))", zIndex: 200,
  maxWidth: 480, margin: "0 auto", minHeight: 52, padding: "8px 10px 8px 16px", borderRadius: "var(--radius-card)",
  background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  boxShadow: "var(--elevation-float)", fontSize: 14,
};

const undoButtonStyle: CSSProperties = {
  minWidth: 72, minHeight: 44, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800,
};

const refreshStatusStyle: CSSProperties = { minHeight: 20, padding: "2px 18px 0", textAlign: "right", color: "var(--muted)", fontSize: 12 };
const draftOverlayStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", padding: 20 };
const draftDialogStyle: CSSProperties = { width: "min(100%, 420px)", padding: 20, borderRadius: "var(--radius-sheet)", background: "var(--surface)", display: "grid", gap: 16 };
const draftSecondaryButtonStyle: CSSProperties = { flex: 1, minHeight: 48, borderRadius: "var(--radius-control)", border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", fontWeight: 700 };
const draftPrimaryButtonStyle: CSSProperties = { ...draftSecondaryButtonStyle, border: 0, background: "var(--accent)", color: "var(--accent-ink)" };
