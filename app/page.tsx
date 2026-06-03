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
import { RebalanceSheet } from "./components/RebalanceSheet";
import { Money } from "./components/Money";
import { PickerPopover } from "./components/PickerPopover";
import type { Account, BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./components/app-types";
import {
  categoryMatchesScope,
  categoryIdMatchesScope,
  evalExpr,
  fmtDate,
  getCategoryScope,
  getLeftToAssignByScope,
  getBalanceByScope,
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

const SAVE_LINES = [
  "Saved. Tiny win unlocked.",
  "Logged and looking sharp.",
  "Done. Budget still in control.",
  "Synced. You are on a roll.",
];

const FALLBACK_ACCOUNTS: Account[] = [];

const formatMonthInput = (dateString: string) => dateString.slice(0, 7);

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
  const [tab, setTab] = useState<"home" | "plan" | "budget" | "history">("home");
  const [budgetScope, setBudgetScope] = useState<BudgetScope>("joint");
  const [plannerMonth, setPlannerMonth] = useState(formatMonthInput(today()));
  const [planCompletedMonth, setPlanCompletedMonth] = useState<string | null>(null);
  const [homeMonth, setHomeMonth] = useState(formatMonthInput(today()));
  const [plannerSummaryReady, setPlannerSummaryReady] = useState(false);
  const [plannerMonthlySummary, setPlannerMonthlySummary] = useState<MonthlySummary | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<Category | null>(null);
  const [showRebalance, setShowRebalance] = useState(false);
  const [showManageScreen, setShowManageScreen] = useState(false);
  const [categoryManageMode, setCategoryManageMode] = useState<"fund" | "create" | null>(null);
  const [categoryManageCategory, setCategoryManageCategory] = useState<Category | null>(null);
  const [incomeAccount, setIncomeAccount] = useState<Account | null>(null);
  const [transferAccount, setTransferAccount] = useState<Account | null>(null);
  const [homeSearch, setHomeSearch] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

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
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);
  const [showSaveBurst, setShowSaveBurst] = useState(false);
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
  const plannerMonthHydrated = useRef(false);
  const loadedPendingId = useRef<string | null>(null);
  const rebalanceReturnToAdd = useRef(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode) document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("budgetScope", budgetScope);
  }, [budgetScope, mounted]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
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
    const data = await fetch("/api/transactions?page_size=100").then((r) => r.json());
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
    if (tab === "history") fetchHistoryTransactions(historyMonth);
  }, [tab, historyMonth, fetchHistoryTransactions]);

  const fetchMonthlySummary = async (month?: string) => {
    try {
      const target = month ?? formatMonthInput(today());
      const { start, end } = monthBounds(`${target}-01`);
      const data = await fetch(`/api/monthly-summary?start=${start}&end=${end}`).then((r) => r.json());
      setMonthlySummary({
        start,
        end,
        totalAssigned: data.summary?.totalAssigned ?? 0,
        totalSpent: data.summary?.totalSpent ?? 0,
        assignedByCategory: data.summary?.assignedByCategory ?? [],
        spentByCategory: data.summary?.spentByCategory ?? [],
      });
    } catch {
      setMonthlySummary({
        start: "",
        end: "",
        totalAssigned: 0,
        totalSpent: 0,
        assignedByCategory: [],
        spentByCategory: [],
      });
    }
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
    const data = await fetch("/api/categories").then((r) => r.json());
    setCategories(data.categories ?? []);
    if (data.categories?.length > 0 && !categoryId) setCategoryId(data.categories[0].id);
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
    fetchCategories().finally(() => setLoading(false));
    fetchFrozenCategories();

    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        const accs: Account[] = data.accounts ?? [];
        setAccounts(accs);
      });

    fetchTransactions();
    fetchPending();
    fetchMonthlyTrend();
  }, []);

  // Refetch monthly summary whenever the viewed home month changes
  useEffect(() => {
    fetchMonthlySummary(homeMonth); // eslint-disable-line react-hooks/exhaustive-deps
  }, [homeMonth]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!plannerMonth) return;
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
  }, [plannerMonth]);

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
    setEditingTransactionId(transaction.id);
    setName(transaction.name);
    setAmount(transaction.amount ? String(transaction.amount) : "");
    setDate(transaction.date || today());
    setSuggestedCatId(null);
    setCatSearch("");
    setShowDatePicker(false);
    setShowCatPicker(false);
    setShowAccountPicker(false);
    if (transaction.category) setCategoryId(transaction.category);
    if (transaction.accountId) setAccountId(transaction.accountId);
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

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setHistoryTransactions((prev) => prev.filter((t) => t.id !== id));
    fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then((r) => { if (!r.ok) { fetchTransactions(); fetchHistoryTransactions(historyMonth); } else fetchMonthlySummary(homeMonth); });
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const plannerUsesFallbackData =
    !plannerSummaryReady || plannerMonth !== formatMonthInput(today());

  const readyToAssignByScope = useMemo(() => getLeftToAssignByScope(accounts), [accounts]);
  const balanceByScope = useMemo(() => getBalanceByScope(accounts), [accounts]);
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

  const openNewCategory = () => {
    setCategoryManageCategory(null);
    setCategoryManageMode("create");
  };

  const refreshBudgetData = (message?: string) => {
    fetchCategories();
    fetchFrozenCategories();
    fetchMonthlySummary(homeMonth);
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
    if (message) showToast(message, 1500);
  };

  const refreshAccountsData = (message?: string) => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
    fetchMonthlySummary(homeMonth);
    if (message) showToast(message, 1500);
  };

  const openMonthlyPlan = () => {
    setPlannerMonth(homeMonth);
    setTab("plan");
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

  const selectedDateLabel =
    date === today() ? "Today" :
    date === shiftDate(today(), -1) ? "Yesterday" :
    date === shiftDate(today(), 1) ? "Tomorrow" :
    fmtDate(date);

  const amountAfterBalance = displayedBalance !== null && amount && parseFloat(amount) > 0
    ? displayedBalance - parseFloat(amount)
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
    if (!amount || !name || !categoryId) return;
    setStatus("saving");
    setErrorMsg("");
    const isEditing = Boolean(editingTransactionId);
    try {
      const payload = { name, amount: parseFloat(amount), accountId, categoryId, date };
      const res = await fetch(isEditing ? "/api/transactions" : "/api/expense", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingTransactionId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setStatus("success");
      setShowSaveBurst(true);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => setShowSaveBurst(false), 850);
      showToast(isEditing ? "Transaction updated" : SAVE_LINES[Math.floor(Math.random() * SAVE_LINES.length)], 1500);

      const newEntry = { description: name.trim(), categoryId };
      setCorpus((prev) => {
        const updated = [...prev, newEntry].slice(-100);
        localStorage.setItem("expenseCorpus", JSON.stringify(updated));
        return updated;
      });

      const expAmt = parseFloat(amount);
      if (!isEditing && displayedBalance !== null) animateBalance(displayedBalance, displayedBalance - expAmt);
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

      setAmount("");
      setName("");
      setEditingTransactionId(null);
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

  const parsedAmount = amount ? evalExpr(amount) : 0;
  const isEditingTransaction = Boolean(editingTransactionId);
  const categoryUnfunded = !isEditingTransaction && !!(selectedCat && selectedCat.available !== null && selectedCat.available === 0);
  const categoryOverBudget = !isEditingTransaction && !!(selectedCat && selectedCat.available !== null && selectedCat.available > 0 && parsedAmount > selectedCat.available);
  const canSubmit = Boolean(amount && parsedAmount > 0 && name.trim() && categoryId && accountId && status === "idle" && !categoryUnfunded && !categoryOverBudget);
  const suggestedCategory = suggestedCatId ? categories.find((c) => c.id === suggestedCatId) : undefined;

  return (
    <AppShell
      tab={tab}
      pendingCount={scopedPendingItems.length}
      onTabChange={(t) => { setTab(t); }}
      onOpenAdd={() => {
        setEditingTransactionId(null);
        setShowAddModal(true);
      }}
      onOpenManage={() => setShowManageScreen(true)}
      toast={microToast}
      showAddButton={tab !== "plan" && !showManageScreen}
      immersive={tab === "plan" || showManageScreen}
    >
      {showManageScreen && (
        <ManageScreen
          accounts={accounts}
          onClose={() => setShowManageScreen(false)}
          onAddIncome={setIncomeAccount}
          onTransferMoney={setTransferAccount}
        />
      )}

      {!showManageScreen && tab === "home" && (
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
          monthlySummary={scopedMonthlySummary}
          walletSummaries={walletMonthlySummaries}
          leftToSpendByScope={leftToSpendByScope}
          balanceByScope={balanceByScope}
          readyToAssignByScope={readyToAssignByScope}
          budgetScope={budgetScope}
          onBudgetScopeChange={setBudgetScope}
          homeMonth={homeMonth}
          onHomeMonthChange={setHomeMonth}
          planDone={planCompletedMonth === homeMonth}
          transactions={scopedTransactions}
          pendingItems={scopedPendingItems}
          onOpenHistory={() => setTab("history")}
        />
      )}

      {!showManageScreen && <MonthlyPlanningFlow
        open={tab === "plan"}
        selectedMonth={plannerMonth}
        onSelectedMonthChange={setPlannerMonth}
        onCancel={() => setTab("home")}
        onComplete={() => {
          setPlanCompletedMonth(plannerMonth);
          refreshBudgetData("Plan saved");
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

      {!showManageScreen && tab === "budget" && (
        <CategoriesScreen
          categories={categories}
          frozenCategories={frozenCategories}
          monthlySummary={monthlySummary}
          homeMonth={homeMonth}
          selectedCategoryId={categoryId}
          onSelectCategory={selectCategory}
          onOpenCategoryDetails={openCategoryDetails}
          onOpenRebalance={() => setShowRebalance(true)}
          onFreezeCategory={freezeCategory}
          onReviveCategory={reviveCategory}
          onFundCategory={openFundCategory}
        />
      )}

      {!showManageScreen && tab === "history" && (
        <InsightsScreen
          transactions={scopedHistoryTransactions}
          categories={categories}
          accounts={accounts}
          budgetScope={budgetScope}
          onBudgetScopeChange={setBudgetScope}
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
        showSaveBurst={showSaveBurst}
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

      <CategoryDetailsSheet
        open={showCategoryDetails}
        category={detailsCategory}
        month={(monthlySummary.start || today()).slice(0, 7)}
        onClose={() => setShowCategoryDetails(false)}
        onOpenAdd={() => {
          if (detailsCategory) selectCategory(detailsCategory);
          setEditingTransactionId(null);
          setShowCategoryDetails(false);
          setShowAddModal(true);
        }}
        onOpenFund={() => {
          if (detailsCategory) openFundCategory(detailsCategory);
        }}
      />

      <CategoryManageSheet
        open={categoryManageMode !== null}
        mode={categoryManageMode ?? "fund"}
        category={categoryManageCategory}
        month={homeMonth}
        accounts={accounts}
        defaultScope={budgetScope}
        onClose={() => setCategoryManageMode(null)}
        onSuccess={refreshBudgetData}
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
        homeMonth={homeMonth}
        monthlySummary={monthlySummary}
        onSuccess={() => {
          refreshBudgetData("Rebalance applied");
          if (rebalanceReturnToAdd.current) {
            rebalanceReturnToAdd.current = false;
            setShowAddModal(true);
          }
        }}
      />

    </AppShell>
  );
}


const ghostActionStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};
