"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { fetchApiJson, fetchMonthlyData, invalidateFinancialReads, loadHomeData, type MonthlyData } from "@/lib/app-data";
import { getPlanningMonth, getNextMonth, type PlanningFund } from "@/lib/planning-month";
import { createCategorySuggester } from "@/lib/category-suggest";
import { AppShell } from "./components/AppShell";
import { BillsSection } from "./components/BillsSection";
import { deriveOccurrences, earmarkedByCategory, normalizedId, type BillsData } from "@/lib/bills";
import { HomeScreen } from "./components/HomeScreen";
const ReflectScreen = dynamic(() => import("./components/ReflectScreen").then(m => m.ReflectScreen), { loading: () => <SkeletonRegion label="Loading Reflect"><Skeleton style={{ height: 220, marginBottom: 16 }} /><SkeletonRows /></SkeletonRegion> });
import { CategoriesScreen } from "./components/CategoriesScreen";
const AddTransactionSheet = dynamic(() => import("./components/AddTransactionSheet").then(m => m.AddTransactionSheet));
const AccountIncomeSheet = dynamic(() => import("./components/AccountIncomeSheet").then(m => m.AccountIncomeSheet));
const AccountTransferSheet = dynamic(() => import("./components/AccountTransferSheet").then(m => m.AccountTransferSheet));
const CategoryDetailsSheet = dynamic(() => import("./components/CategoryDetailsSheet").then(m => m.CategoryDetailsSheet));
const CategoryManageSheet = dynamic(() => import("./components/CategoryManageSheet").then(m => m.CategoryManageSheet));
const SavingsWithdrawSheet = dynamic(() => import("./components/SavingsWithdrawSheet").then(m => m.SavingsWithdrawSheet));
const ManageScreen = dynamic(() => import("./components/ManageScreen").then(m => m.ManageScreen));
const AccountDetailsSheet = dynamic(() => import("./components/AccountDetailsSheet").then(m => m.AccountDetailsSheet));
const RebalanceSheet = dynamic(() => import("./components/RebalanceSheet").then(m => m.RebalanceSheet));
import { calculateMonthPlanCapacity, getPlanningSplit, type PlanAmounts } from "./components/month-plan-capacity";
const MonthPlanSheet = dynamic(() => import("./components/MonthPlanSheet").then(m => m.MonthPlanSheet));
const TransactionDetailsSheet = dynamic(() => import("./components/TransactionDetailsSheet").then(m => m.TransactionDetailsSheet));
import { getCategoryAllocatedByScope, isSavingsCategory, scopeMonthlySummary } from "./components/wallet-utils";
import { calculateContributionStatus } from "./components/contribution-utils";
import type { Account, AppTab, BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./components/app-types";
import {
  categoryMatchesScope,
  categoryIdMatchesScope,
  evalExpr,
  expenseBudgetGate,
  isPastMonth,
  expenseBalancePreview,
  fmtDate,
  getCategoryScope,
  getAssignBalanceByScope,
  withAssignable,
  getLeftToAssignByScope,
  getBalanceByScope,
  getJointAccountUnassigned,
  isSavingsAccount,
  monthBounds,
  shiftDate,
  today,
  transactionMatchesScope,
} from "./components/app-utils";
import { AppLoadingSkeleton, Skeleton, SkeletonRegion, SkeletonRows } from "./components/ui/Skeleton";

type SessionUser = { email: string | null; name: string | null; avatarUrl: string | null };

const FALLBACK_ACCOUNTS: Account[] = [];

const formatMonthInput = (dateString: string) => dateString.slice(0, 7);

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [withdrawCategory, setWithdrawCategory] = useState<Category | null>(null);
  const [mode, setMode] = useState<"wife" | "husband">("husband");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [categories, setCategories] = useState<Category[]>([]);
  const [frozenCategories, setFrozenCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(FALLBACK_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contributionTransactions, setContributionTransactions] = useState<Transaction[]>([]);
  const [billsData, setBillsData] = useState<BillsData | null>(null);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState<string | null>(null);
  const billsRequest = useRef(0);
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
  const [monthLoading, setMonthLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [planningReady, setPlanningReady] = useState(false);
  const [currentMonthFunds, setCurrentMonthFunds] = useState<PlanningFund[] | null>(null);
  const [openedPlanningMonth, setOpenedPlanningMonth] = useState<string | null>(null);
  const [currentPlanCapacity, setCurrentPlanCapacity] = useState<PlanAmounts | null>(null);
  const calendarMonth = formatMonthInput(today());
  const nextCalendarMonth = getNextMonth(calendarMonth);
  const monthlySnapshot = useRef<{ month: string; data: MonthlyData; expires: number } | null>(null);
  const budgetRefresh = useRef<{ month: string; promise: Promise<void>; rerun: boolean; started: boolean } | null>(null);
  // Once opened, keep the sheet mounted for exit animations and its draft state.
  const [accountDetailsLoaded, setAccountDetailsLoaded] = useState(false);

  const [monthError, setMonthError] = useState(false);
  const monthRequest = useRef(0);
  const catalogRequest = useRef(0);
  const accountsRequest = useRef(0);
  const transactionsRequest = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [financialSources, setFinancialSources] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const syncTimestamp = Object.values(financialSources).sort()[0] ?? null;
  useEffect(() => {
    const handler = (event: Event) => {
      const { url, syncedAt } = (event as CustomEvent<{ url: string; syncedAt: string | null }>).detail;
      setFinancialSources(previous => {
        const next = { ...previous };
        if (syncedAt) next[url] = syncedAt; else delete next[url];
        return next;
      });
    };
    window.addEventListener("finance-data-source", handler);
    return () => window.removeEventListener("finance-data-source", handler);
  }, []);
  const [refreshState, setRefreshState] = useState<"idle" | "updating" | "stale">("idle");
  const [budgetRefreshing, setBudgetRefreshing] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [tab, setTab] = useState<AppTab>("home");
  const [budgetScope, setBudgetScope] = useState<BudgetScope>("joint");
  const [nextMonthFunds, setNextMonthFunds] = useState<{ categoryId: string; planned: number; reverse?: boolean }[]>([]);
  const monthStartPlannerMonth = useMemo(() => {
    if (currentMonthFunds === null) return null;
    const normalize = (id: string) => id.replace(/-/g, "").toLowerCase();
    const scopedIds = new Set([...categories, ...frozenCategories]
      .filter(category => getCategoryScope(category, accounts) === budgetScope)
      .map(category => normalize(category.id)));
    return getPlanningMonth(calendarMonth, currentMonthFunds.filter(fund => scopedIds.has(normalize(fund.categoryId))));
  }, [calendarMonth, currentMonthFunds, categories, frozenCategories, accounts, budgetScope]);
  const planningFunds = useMemo(() => monthStartPlannerMonth === calendarMonth ? currentMonthFunds ?? [] : nextMonthFunds, [monthStartPlannerMonth, calendarMonth, currentMonthFunds, nextMonthFunds]);
  const [homeMonth, setHomeMonth] = useState(formatMonthInput(today()));
  const [showAddModal, setShowAddModal] = useState(false);
  const transactionSaveBusy = useRef(false);
  const [recurringRepeat, setRecurringRepeat] = useState<"None" | "Monthly" | "Yearly">("None");
  const [recurringBillId, setRecurringBillId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<"Expense" | "Income">("Expense");
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<Category | null>(null);
  const [showRebalance, setShowRebalance] = useState(false);
  const [showManageScreen, setShowManageScreen] = useState(false);
  const [showMonthStartPlanner, setShowMonthStartPlanner] = useState(false);
  const [categoryManageMode, setCategoryManageMode] = useState<"fund" | "create" | "edit" | null>(null);
  const [categoryManageCategory, setCategoryManageCategory] = useState<Category | null>(null);
  const [categoryManageDefaultType, setCategoryManageDefaultType] = useState<string | undefined>(undefined);
  const [incomeAccount, setIncomeAccount] = useState<Account | null>(null);
  const [transferAccount, setTransferAccount] = useState<Account | null>(null);
  const [transferPreset, setTransferPreset] = useState<{ toAccountId: string; amount: number; note: string } | null>(null);
  const [detailsAccount, setDetailsAccount] = useState<Account | null>(null);
  useEffect(() => { if (detailsAccount) setAccountDetailsLoaded(true); }, [detailsAccount]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<{ amount: number; accountId: string; categoryId: string | null } | null>(null);
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
  const [draftOffer, setDraftOffer] = useState<{ amount: string; name: string; accountId: string; categoryId: string; date: string; scope: BudgetScope; timestamp: number; repeat?: "None" | "Monthly" | "Yearly" } | null>(null);

  const [microToast, setMicroToast] = useState<string | null>(null);
  const [lastUsedCatId, setLastUsedCatId] = useState("");
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const [historyStartMonth, setHistoryStartMonth] = useState(formatMonthInput(today()));
  const [reflectView, setReflectView] = useState<"spending" | "activity">("spending");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequest = useRef(0);
  const [historyMonth, setHistoryMonth] = useState(formatMonthInput(today()));
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [corpus, setCorpus] = useState<{ description: string; categoryId: string }[]>([]);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);
  const initialAcctApplied = useRef(false);
  const initialCatApplied = useRef(false);
  const initialLoadStarted = useRef(false);
  const initialLoadComplete = useRef(false);
  const coreReady = useRef(false);
  const rebalanceReturnToAdd = useRef(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const balanceAnimRef = useRef<number | null>(null);
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
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setSessionUser(data?.user ?? null))
      .catch(() => setSessionUser(null));
  }, []);

  useEffect(() => {
    if (mode) document.documentElement.dataset.mode = mode;
  }, [mode]);

  // Selected states take the wallet's colour (--select-* tokens in globals.css).
  useEffect(() => {
    document.documentElement.dataset.scope = budgetScope;
  }, [budgetScope]);

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

  const fetchTransactions = async () => {
    const request = ++transactionsRequest.current;
    const data = await fetchApiJson<{ transactions?: Transaction[] }>("/api/transactions?page_size=100");
    if (request !== transactionsRequest.current) return;
    const txns: Transaction[] = data.transactions ?? [];
    setTransactions(txns);
    let hasCorpus = false;
    try { hasCorpus = Boolean(localStorage.getItem("expenseCorpus")); } catch {}
    if (!hasCorpus) {
      const entries = txns.slice(0, 50).filter(t => t.name && t.category)
        .map(t => ({ description: t.name, categoryId: t.category! }));
      setCorpus(entries);
      try { localStorage.setItem("expenseCorpus", JSON.stringify(entries)); } catch {}
    }
    const latestCat = txns.find(t => (!t.type || t.type === "Expense") && t.category)?.category;
    if (latestCat) setLastUsedCatId(latestCat);
  };

  const fetchHistoryTransactions = useCallback(async (startMonth: string, endMonth = startMonth) => {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryTransactions([]);
    try {
      const query = startMonth
        ? `start=${monthBounds(`${startMonth}-01`).start}&end=${monthBounds(`${endMonth}-01`).end}`
        : "all=true";
      const snapshot = monthlySnapshot.current;
      const txns = startMonth && startMonth === endMonth && startMonth === homeMonth
        ? (snapshot?.month === startMonth && snapshot.expires > Date.now()
          ? snapshot.data.transactions
          : (await fetchMonthlyData(startMonth, endMonth)).transactions)
        : (await fetchApiJson<{ transactions: Transaction[] }>(`/api/transactions?${query}`)).transactions;
      if (request === historyRequest.current) setHistoryTransactions(txns ?? []);
    } catch (error) {
      if (request === historyRequest.current) setHistoryError(error instanceof Error ? error.message : "Could not load Reflect");
      throw error;
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false);
    }
  }, [homeMonth]);

  useEffect(() => {
    if (tab !== "history") return;
    void fetchHistoryTransactions(historyStartMonth, historyMonth).catch(() => {});
  }, [tab, historyStartMonth, historyMonth, fetchHistoryTransactions]);

  const fetchMonthlySummary = async (month?: string) => {
    const request = ++monthRequest.current;
    setMonthLoading(true);
    setMonthError(false);
    try {
      const target = month ?? formatMonthInput(today());
      const { start, end } = monthBounds(`${target}-01`);
      const data = await fetchMonthlyData(target);
      if (request !== monthRequest.current) return;
      monthlySnapshot.current = { month: target, data, expires: Date.now() + 15000 };
      if (target === formatMonthInput(today())) setCurrentMonthFunds(data.funds ?? []);
      setContributionTransactions(data.transactions ?? []);
      setMonthlySummary({
        start,
        end,
        totalAssigned: data.summary?.totalAssigned ?? 0,
        totalSpent: data.summary?.totalSpent ?? 0,
        assignedByCategory: data.summary?.assignedByCategory ?? [],
        spentByCategory: data.summary?.spentByCategory ?? [],
      });
    } catch (error) {
      if (request === monthRequest.current) setMonthError(true);
      throw error;
    } finally {
      if (request === monthRequest.current) setMonthLoading(false);
    }
  };

  const fetchBills = async () => {
    const request = ++billsRequest.current;
    setBillsLoading(true);
    try {
      const data = await fetchApiJson<BillsData>("/api/bills");
      if (request === billsRequest.current) { setBillsData(data); setBillsError(null); }
    } catch (error) {
      if (request === billsRequest.current) setBillsError(error instanceof Error ? error.message : "Could not load bills");
      throw error;
    } finally { if (request === billsRequest.current) setBillsLoading(false); }
  };

  const fetchPending = async () => {
    try {
      const cached = localStorage.getItem("pendingItems");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setPendingItems(parsed);
      }
    } catch {}
    const data = await fetchApiJson<{ items: PendingItem[] }>("/api/pending");
    if (Array.isArray(data.items)) {
      setPendingItems(data.items);
      try { localStorage.setItem("pendingItems", JSON.stringify(data.items)); } catch {}
    }
  };

  const fetchCategories = () => fetchCategoryCatalog();

  const fetchCategoryCatalog = async () => {
    const request = ++catalogRequest.current;
    const data = await fetchApiJson<{ categories?: Category[] }>("/api/categories?includeSnoozed=true");
    if (request !== catalogRequest.current) return;
    const catalog: Category[] = data.categories ?? [];
    const active = catalog.filter((category) => !category.snoozed && !category.archived);
    setCategories(active);
    setFrozenCategories(catalog.filter((category) => category.snoozed && !category.archived));
    if (active.length > 0 && !categoryId) setCategoryId(active[0].id);
  };

  const fetchAccounts = async () => {
    const request = ++accountsRequest.current;
    const data = await fetchApiJson<{ accounts?: Account[] }>("/api/accounts");
    if (request === accountsRequest.current) setAccounts(data.accounts ?? []);
  };


  useEffect(() => {
    if (initialLoadStarted.current && loadAttempt === 0) return;
    initialLoadStarted.current = true;

    const loadLiveData = async () => {
      try {
        setLoading(!coreReady.current);
        setLoadError(null);
        setSecondaryLoading(true);
        const results = await loadHomeData({
          essentials: [fetchCategoryCatalog, fetchAccounts],
          onReady: () => { coreReady.current = true; initialLoadComplete.current = true; setLoading(false); },
          secondary: [fetchTransactions, fetchPending, fetchBills, () => fetchMonthlySummary(homeMonth), fetchNextMonthFunds],
        });
        setRefreshState(results.some(result => result.status === "rejected") ? "stale" : "idle");
      } catch (error) {
        console.error("[app] Failed to load live data:", error);
        if (coreReady.current) setRefreshState("stale");
        else setLoadError(error instanceof Error ? error.message : "Could not load financial data");
      } finally {
        initialLoadComplete.current = coreReady.current;
        setSecondaryLoading(false);
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
    const payload = { version: 1, timestamp: Date.now(), amount, name, accountId, categoryId, date, scope: budgetScope, repeat: recurringRepeat };
    if (!amount && !name) return;
    try { localStorage.setItem(`expenseDraft:v1:${mode}`, JSON.stringify(payload)); } catch {}
  }, [mounted, showAddModal, editingTransactionId, draftOffer, amount, name, accountId, categoryId, date, budgetScope, mode, recurringRepeat]);

  // Refetch monthly summary whenever the viewed home month changes
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    void fetchMonthlySummary(homeMonth).catch((error) => {
      console.error("[app] Failed to refresh monthly summary:", error);
      setRefreshState("stale");
    }); // eslint-disable-line react-hooks/exhaustive-deps
  }, [homeMonth]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (current && categoryMatchesScope(current, budgetScope, accounts)) return;
    const nextCategory = categories.find((category) => categoryMatchesScope(category, budgetScope, accounts));
    if (nextCategory) setCategoryId(nextCategory.id);
  }, [budgetScope, categories, categoryId, accounts]);

  useEffect(() => {
    const raw = localStorage.getItem("expenseCorpus");
    if (raw) {
      try {
        setCorpus(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const suggestFromHistory = useMemo(() => createCategorySuggester(corpus), [corpus]);

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

  const editTransaction = (transaction: Transaction) => {
    if (transaction.type !== "Expense" && transaction.type != null) {
      setDetailsTransaction(transaction);
      return;
    }
    setEditingTransactionId(transaction.id);
    setTransactionType("Expense");
    setEditingOriginal({ amount: transaction.amount, accountId: transaction.accountId ?? "", categoryId: transaction.category ?? null });
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
    setShowAddModal(true);
  };

  const refreshAffectedData = useCallback(async () => {
    setRefreshState("updating");
    setBillsLoading(true);
    invalidateFinancialReads();
    monthlySnapshot.current = null;
    const results = await Promise.allSettled([
      refreshBudgetData(), fetchTransactions(), fetchBills(),
      ...(tab === "history" ? [fetchHistoryTransactions(historyStartMonth, historyMonth)] : []),
    ]);
    if (results.some(result => result.status === "rejected")) {
      setRefreshState("stale");
      setBillsLoading(false);
      setBillsError("Balances could not refresh. Refresh before changing bills.");
      throw new Error("Some balances or activity could not be refreshed");
    }
    setRefreshState("idle");
  }, [historyStartMonth, historyMonth, homeMonth, tab, fetchHistoryTransactions]);

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

  const balanceByScope = useMemo(() => getBalanceByScope(accounts), [accounts]);
  const jointUnassigned = useMemo(() => getJointAccountUnassigned(accounts), [accounts]);

  // Derive which scopes have allocations for the month offered by the planner.
  const plannedScopes = useMemo((): Record<"joint" | "anas" | "salma", boolean> => {
    if (!planningFunds.length) return { joint: false, anas: false, salma: false };
    const fundedIds = new Set(planningFunds.filter((f) => !f.reverse && f.planned > 0).map((f) => f.categoryId));
    const all = [...categories, ...frozenCategories];
    return {
      joint: all.filter((c) => getCategoryScope(c, accounts) === "joint").some((c) => fundedIds.has(c.id)),
      anas:  all.filter((c) => getCategoryScope(c, accounts) === "anas").some((c) => fundedIds.has(c.id)),
      salma: all.filter((c) => getCategoryScope(c, accounts) === "salma").some((c) => fundedIds.has(c.id)),
    };
  }, [planningFunds, categories, frozenCategories, accounts]);

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

  const refreshBudgetData = (message?: string): Promise<void> => {
    if (budgetRefresh.current?.month === homeMonth) {
      const entry = budgetRefresh.current;
      // Same-turn callbacks share one refresh. A later save while a read is in
      // progress gets a trailing fresh pass, rather than accepting old balances.
      if (entry.started) entry.rerun = true;
      if (message) void entry.promise.then(() => showToast(message, 1500)).catch(() => {});
      return entry.promise;
    }
    setBudgetRefreshing(true);
    monthlySnapshot.current = null;
    invalidateFinancialReads();
    const entry = { month: homeMonth, promise: Promise.resolve(), rerun: false, started: false };
    const promise = (async () => {
      await Promise.resolve();
      entry.started = true;
      do {
        entry.rerun = false;
        const results = await Promise.allSettled([fetchCategoryCatalog(), fetchMonthlySummary(homeMonth), fetchAccounts()]);
        if (results.some(result => result.status === "rejected")) {
          setRefreshState("stale");
          throw new Error("Some balances could not be refreshed");
        }
        if (entry.rerun) invalidateFinancialReads();
      } while (entry.rerun);
    })();
    entry.promise = promise;
    budgetRefresh.current = entry;
    void promise.then(() => {
      if (budgetRefresh.current?.promise === promise) { budgetRefresh.current = null; setBudgetRefreshing(false); }
    }, () => {
      if (budgetRefresh.current?.promise === promise) { budgetRefresh.current = null; setBudgetRefreshing(false); }
    });
    // Existing sheet callbacks may fire-and-forget. Surface failures without an
    // unhandled rejection while still rejecting to callers that await refresh.
    void promise.catch(error => showToast(error.message));
    if (message) void promise.then(() => showToast(message, 1500)).catch(() => {});
    return promise;
  };

  const refreshAccountsData = (message?: string) => {
    void refreshBudgetData(message).catch(() => {});
  };

  const syncFromNotion = async () => {
    if (syncing) return;
    setSyncing(true);
    const started = Date.now();
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) throw new Error("Could not start sync. Try again.");
      const { previousSyncedAt } = await response.json();
      while (Date.now() - started < 120000) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch("/api/sync", { cache: "no-store" });
        if (!statusResponse.ok) throw new Error("Could not check sync. Try again.");
        const status = await statusResponse.json();
        if (status.current && status.syncedAt && status.syncedAt !== previousSyncedAt) {
          invalidateFinancialReads();
          monthlySnapshot.current = null;
          setLoadAttempt(value => value + 1);
          return;
        }
      }
      showToast("Sync is still running. Try again shortly.", 4000);
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not sync", 4000); }
    finally { setSyncing(false); }
  };

  const fetchNextMonthFunds = async () => {
    try {
      const data = await fetchApiJson<{ funds?: typeof nextMonthFunds }>(`/api/monthly-planning/funds?month=${nextCalendarMonth}`);
      setNextMonthFunds(data.funds ?? []);
      setPlanningReady(true);
    } catch (error) {
      setPlanningReady(false);
      setRefreshState("stale");
      throw error;
    }
  };

  const openMonthlyPlan = () => {
    if (!monthStartPlannerMonth) return;
    setOpenedPlanningMonth(monthStartPlannerMonth);
    // Saving this month's first allocations updates live balances. Keep the
    // opening pool so those saved allocations are deducted only once in-sheet.
    if (monthStartPlannerMonth === calendarMonth) {
      const capacity = { ...assignBalanceByScope };
      const normalize = (id: string) => id.replace(/-/g, "").toLowerCase();
      const catalog = new Map([...categories, ...frozenCategories].map(category => [normalize(category.id), category]));
      for (const fund of currentMonthFunds ?? []) {
        const category = catalog.get(normalize(fund.categoryId));
        const owner = category && getCategoryScope(category, accounts);
        if (owner && !fund.reverse) capacity[owner] += fund.planned;
      }
      setCurrentPlanCapacity(capacity);
    } else setCurrentPlanCapacity(null);
    setShowMonthStartPlanner(true);
  };

  const reviveCategory = async (category: Category, openFunding = true) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, snoozed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revive category");
      refreshBudgetData(`${category.name} revived`);
      if (openFunding) {
        setCategoryManageCategory({ ...category, snoozed: false });
        setCategoryManageMode("fund");
      }
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
    .filter((c) => categoryMatchesScope(c, budgetScope, accounts))
    .filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.id === lastUsedCatId) return -1;
      if (b.id === lastUsedCatId) return 1;
      return 0;
    });

  const filteredAccounts = accounts;

  const homeCategories = [...categories]
    .sort((a, b) => {
      if (a.id === lastUsedCatId) return -1;
      if (b.id === lastUsedCatId) return 1;
      return a.name.localeCompare(b.name);
    });

  const getMonthlySummaryForScope = useCallback((scope: BudgetScope): MonthlySummary => {
    return scopeMonthlySummary(monthlySummary, categories, accounts, scope);
  }, [categories, accounts, monthlySummary]);

  const scopedMonthlySummary = useMemo(() => {
    return getMonthlySummaryForScope(budgetScope);
  }, [budgetScope, getMonthlySummaryForScope]);

  const categoryAvailableByScope = useMemo<Record<BudgetScope, number>>(() => {
    if (isPastMonth(homeMonth)) return { joint: 0, anas: 0, salma: 0 };
    return getCategoryAllocatedByScope(categories, accounts);
  }, [categories, accounts, homeMonth]);

  const scopedTransactions = useMemo(
    () => transactions.filter((transaction) => transactionMatchesScope(transaction, categories, budgetScope, accounts)),
    [budgetScope, categories, transactions, accounts],
  );

  const scopedPendingItems = useMemo(
    () => pendingItems.filter((item) => categoryIdMatchesScope(item.categoryId, categories, budgetScope)),
    [budgetScope, categories, pendingItems],
  );

  // Who is signed in, from the Notion identity: decides whose budget "personal" means.
  const sessionPartner = useMemo((): "anas" | "salma" | null => {
    if (!sessionUser) return null;
    const identity = ((sessionUser.name || "") + " " + (sessionUser.email || "")).toLowerCase();
    if (identity.includes("salma") || identity.includes("wife")) return "salma";
    if (identity.includes("anas") || identity.includes("husband")) return "anas";
    return null;
  }, [sessionUser]);

  // The mode used to come only from a localStorage key nothing ever wrote, so every
  // device defaulted to husband. Follow the signed-in person instead, and remember it.
  useEffect(() => {
    if (!sessionPartner) return;
    const nextMode = sessionPartner === "salma" ? "wife" : "husband";
    setMode(nextMode);
    document.documentElement.dataset.mode = nextMode;
    try { localStorage.setItem("identity", nextMode); } catch { /* private mode */ }
  }, [sessionPartner]);

  // Remaining partner contributions reconcile current allocations with account cash.
  const contribStatus = useMemo(() => calculateContributionStatus({
    accounts,
    categories,
    transactions: contributionTransactions,
    monthlySummary,
  }), [accounts, categories, contributionTransactions, monthlySummary]);

  const readyToAssignByScope = useMemo(() => getLeftToAssignByScope(
    accounts,
    contribStatus ? {
      anas: Math.max(0, contribStatus.anasPlan - contribStatus.anasActual),
      salma: Math.max(0, contribStatus.salmaPlan - contribStatus.salmaActual),
    } : undefined,
  ), [accounts, contribStatus]);
  const assignBalanceByScope = useMemo(() => getAssignBalanceByScope(
    accounts,
    contribStatus ? {
      anas: Math.max(0, contribStatus.anasPlan - contribStatus.anasActual),
      salma: Math.max(0, contribStatus.salmaPlan - contribStatus.salmaActual),
    } : undefined,
  ), [accounts, contribStatus]);
  // Accounts as the UI shows them: personal "ready to assign" keeps back the Joint due.
  const displayAccounts = useMemo(() => withAssignable(
    accounts,
    contribStatus ? {
      anas: Math.max(0, contribStatus.anasPlan - contribStatus.anasActual),
      salma: Math.max(0, contribStatus.salmaPlan - contribStatus.salmaActual),
    } : undefined,
  ), [accounts, contribStatus]);
  const contributionRemainingByScope = useMemo((): Record<BudgetScope, number> => ({
    joint: 0,
    anas: contribStatus ? Math.max(0, contribStatus.anasPlan - contribStatus.anasActual) : 0,
    salma: contribStatus ? Math.max(0, contribStatus.salmaPlan - contribStatus.salmaActual) : 0,
  }), [contribStatus]);

  const nextMonthRemaining = useMemo(() => {
    if (monthStartPlannerMonth === calendarMonth) return assignBalanceByScope;
    const totals: PlanAmounts = { joint: 0, anas: 0, salma: 0 };
    const normalize = (id: string) => id.replace(/-/g, "").toLowerCase();
    const catalog = new Map([...categories, ...frozenCategories].map((c) => [normalize(c.id), c]));
    for (const fund of planningFunds) {
      if (fund.reverse || !fund.categoryId) continue;
      const cat = catalog.get(normalize(fund.categoryId));
      const owner = cat && getCategoryScope(cat, accounts);
      if (owner) totals[owner] += fund.planned;
    }
    return calculateMonthPlanCapacity(
      { joint: jointUnassigned, anas: assignBalanceByScope.anas, salma: assignBalanceByScope.salma },
      totals, getPlanningSplit(accounts),
    ).left;
  }, [planningFunds, categories, frozenCategories, accounts, jointUnassigned, assignBalanceByScope, monthStartPlannerMonth, calendarMonth]);

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
    setSuggestedCatId(suggestFromHistory(query, categories));
  };

  const submit = async (repeat: "None" | "Monthly" | "Yearly" = "None") => {
    if (transactionSaveBusy.current || !amount || !name || !accountId || (transactionType === "Expense" && !categoryId)) return;
    if (recurringBillId && (repeat === "None" || transactionType !== "Expense" || editingTransactionId)) { setErrorMsg("Finish the saved recurring bill from Bills, or retry with its original repeat interval."); setStatus("error"); return; }
    transactionSaveBusy.current = true;
    setStatus("saving");
    setErrorMsg("");
    const isEditing = Boolean(editingTransactionId);
    try {
      const payload = { name, amount: evalExpr(amount), accountId, categoryId, date, ...(!isEditing && transactionType === "Expense" ? { repeat, ...(recurringBillId ? { billId: recurringBillId } : {}) } : {}) };
      const endpoint = isEditing ? "/api/transactions" : transactionType === "Income" ? "/api/monthly-income" : "/api/expense";
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingTransactionId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) { if (data.billId) { setRecurringBillId(data.billId); void refreshAffectedData().catch(() => {}); } throw new Error(data.error || "Failed"); }

      setRecurringBillId(null);
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
      void refreshAffectedData().catch(error => showToast(error.message));
      // Re-fetch categories after a short delay — Notion computed properties (formulas/rollups)
      // may not reflect the new transaction immediately.
      setTimeout(() => {
        void refreshBudgetData().catch(() => {});
      }, 1500);

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
    } finally { transactionSaveBusy.current = false; }
  };

  // Not yet mounted: server and first client render must match — show a neutral shell
  if (!mounted || loading) return <AppLoadingSkeleton />;

  if (loadError) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)" }}><section role="alert" style={{ maxWidth: 420, padding: 20, borderRadius: "var(--radius-card)", background: "var(--surface)", boxShadow: "var(--elevation-card)" }}><h1 style={{ fontSize: 22 }}>Could not load your finances</h1><p style={{ margin: "10px 0 18px", color: "var(--text2)" }}>No balances were replaced. Check the connection and try again.</p><button type="button" onClick={() => setLoadAttempt(value => value + 1)} style={{ minHeight: 48, padding: "0 18px", border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 800 }}>Retry</button></section></main>;
  }

  const parsedAmount = amount ? evalExpr(amount) : 0;
  const isEditingTransaction = Boolean(editingTransactionId);
  const budgetGate = transactionType === "Expense" && selectedCat
    ? expenseBudgetGate({
      available: selectedCat.available,
      amount: parsedAmount,
      originalAmount: isEditingTransaction && editingOriginal?.categoryId === selectedCat.id ? editingOriginal.amount : 0,
    })
    : { unfunded: false, overBudget: false, shortfall: 0 };
  const categoryUnfunded = budgetGate.unfunded;
  const categoryOverBudget = budgetGate.overBudget;
  const billReservations = billsData && !billsLoading && !billsError
    ? earmarkedByCategory(deriveOccurrences(billsData.schedules, billsData.payments, billsData.today, billsData.today.slice(0, 7)), monthBounds(`${billsData.today.slice(0, 7)}-01`).end)
    : null;
  const reservedForCategory = selectedCat ? billReservations?.[normalizedId(selectedCat.id)] ?? 0 : 0;
  const originalInCategory = isEditingTransaction && editingOriginal?.categoryId === selectedCat?.id ? editingOriginal!.amount : 0;
  const billShortfall = transactionType === "Expense" && selectedCat?.available != null && reservedForCategory > 0
    ? Math.max(0, reservedForCategory - (selectedCat.available + originalInCategory - parsedAmount)) : 0;
  const canSubmit = Boolean(amount && parsedAmount > 0 && name.trim() && accountId && (transactionType === "Income" || categoryId) && status === "idle" && !categoryUnfunded && !categoryOverBudget);
  const suggestedCategory = suggestedCatId ? categories.find((c) => c.id === suggestedCatId) : undefined;

  return (
    <AppShell
      tab={tab}
      onTabChange={(t) => { if (t === "history") setReflectView("spending"); setTab(t); setShowManageScreen(false); }}
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
      onReflectSearch={() => window.dispatchEvent(new Event("open-reflect-search"))}
      onBudgetRebalance={() => setShowRebalance(true)}
      theme={theme}
      onSelectTheme={selectTheme}
      toast={microToast}
      syncTimestamp={syncTimestamp}
      syncing={syncing}
      onSync={() => { void syncFromNotion(); }}
      showAddButton={!showManageScreen}
    >
      {refreshState !== "idle" && (
        <div role="status" aria-live="polite" style={refreshStatusStyle}>
          {refreshState === "updating" ? <SkeletonRegion label="Updating balances"><Skeleton style={{ width: 84, height: 10 }} /></SkeletonRegion> : <><span>Could not refresh</span> <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>Retry</button></>}
        </div>
      )}
      {showManageScreen && (
        <ManageScreen
          accounts={displayAccounts}
          budgetScope={budgetScope}
          onClose={() => setShowManageScreen(false)}
          onOpenDetails={setDetailsAccount}
        />
      )}

      <DeferredMount active={showMonthStartPlanner}>      <MonthPlanSheet
        open={showMonthStartPlanner}
        onClose={() => setShowMonthStartPlanner(false)}
        onSaved={() => {
          refreshBudgetData("Plan saved");
          void fetchNextMonthFunds().catch(() => {});
        }}
        onCategoriesChanged={() => {
          void fetchCategoryCatalog().catch(error => showToast(error.message));
        }}
        planningMonth={openedPlanningMonth ?? monthStartPlannerMonth ?? calendarMonth}
        scope={budgetScope}
        categories={categories.filter((c) => !c.snoozed && !c.archived)}
        frozenCategories={frozenCategories}
        accounts={accounts}
        planningCapacity={currentPlanCapacity ?? { joint: jointUnassigned, anas: assignBalanceByScope.anas, salma: assignBalanceByScope.salma }}
      /></DeferredMount>

      {tab === "home" && (
        <HomeScreen
          billsSection={<BillsSection data={billsData} loading={billsLoading || refreshState === "updating"} error={billsError} categories={[...categories, ...frozenCategories]} accounts={accounts} scope={budgetScope} onRetry={() => { void refreshAffectedData().catch(error => showToast(error.message)); }} onChanged={refreshAffectedData} />}
          monthlyLoading={!monthError && (monthLoading || monthlySummary.start !== monthBounds(`${homeMonth}-01`).start)}
          monthlyError={monthError}
          secondaryLoading={secondaryLoading}
          planningReady={currentMonthFunds !== null && (monthStartPlannerMonth === calendarMonth || planningReady)}
          planningMonth={monthStartPlannerMonth ?? undefined}
          categories={homeCategories}
          onOpenPlan={openMonthlyPlan}
          contribStatus={contribStatus}
          monthlySummary={scopedMonthlySummary}
          categoryAvailableByScope={categoryAvailableByScope}
          balanceByScope={balanceByScope}
          readyToAssignByScope={readyToAssignByScope}
          budgetScope={budgetScope}
          homeMonth={homeMonth}
          onHomeMonthChange={setHomeMonth}
          plannedScopes={plannedScopes}
          planningRemaining={nextMonthRemaining}
          transactions={scopedTransactions}
          pendingItems={scopedPendingItems}
          onOpenHistory={() => { setReflectView("activity"); setTab("history"); }}
          onClickTransaction={editTransaction}
          jointUnassigned={jointUnassigned}
          onOpenAssign={() => setShowRebalance(true)}
        />
      )}


      {tab === "budget" && (
        <CategoriesScreen
          categories={categories}
          frozenCategories={frozenCategories}
          accounts={accounts}
          readyToAssignByScope={readyToAssignByScope}
          assignBalanceByScope={assignBalanceByScope}
          contributionRemainingByScope={contributionRemainingByScope}
          monthlySummary={monthlySummary}
          homeMonth={homeMonth}
          onHomeMonthChange={(month) => {
            if (month === homeMonth) return;
            monthRequest.current += 1;
            setMonthLoading(true);
            setMonthError(false);
            setHomeMonth(month);
          }}
          monthError={monthError}
          onRetryMonth={() => { void fetchMonthlySummary(homeMonth).catch(() => {}); }}
          contribStatus={contribStatus}
          budgetScope={budgetScope}
          onOpenCategoryDetails={openCategoryDetails}
          onOpenRebalance={() => setShowRebalance(true)}
          onReviveCategory={reviveCategory}
          onMoveContribution={() => {
            const sourceNeedle = budgetScope === "anas" ? "hubb" : "wife";
            const source = accounts.find(account => !isSavingsAccount(account) && account.label.toLowerCase().includes(sourceNeedle));
            const destination = accounts.find(account => account.label.toLowerCase().includes("joined") || account.label.toLowerCase().includes("joint"));
            if (!source || !destination) {
              showToast("Personal or Joint account is missing");
              return;
            }
            setTransferPreset({
              toAccountId: destination.id,
              amount: contributionRemainingByScope[budgetScope],
              note: `Joint contribution for ${homeMonth}`,
            });
            setTransferAccount(source);
          }}
          onOpenNewCategory={openNewCategory}
          planMonth={monthStartPlannerMonth ?? undefined}
          onOpenPlan={openMonthlyPlan}
          loading={monthLoading || budgetRefreshing || refreshState === "updating"}
        />
      )}

      {tab === "history" && (
        <ReflectScreen
          transactions={historyTransactions}
          categories={[...categories, ...frozenCategories]}
          accounts={accounts}
          budgetScope={budgetScope}
          period={{ start: historyStartMonth, end: historyMonth }}
          onPeriodChange={period => { setHistoryStartMonth(period.start); setHistoryMonth(period.end); }}
          view={reflectView}
          onViewChange={setReflectView}
          error={historyError}
          onRetry={() => { void fetchHistoryTransactions(historyStartMonth, historyMonth).catch(() => {}); }}
          transactionsLoading={historyLoading}
          onClickTransaction={editTransaction}
          onDeleteTransaction={deleteTransaction}
        />
      )}

      <DeferredMount active={showAddModal}>      <AddTransactionSheet
        open={showAddModal}
        mode={mode}
        repeat={recurringRepeat}
        onRepeatChange={setRecurringRepeat}
        typedDraftKey={`typedDraft:v2:${mode}:${budgetScope}`}
        typedCategories={categories.filter(c => !isSavingsCategory(c) && categoryMatchesScope(c, budgetScope, accounts))}
        typedHistory={corpus}
        onSaveTyped={async (transaction) => {
          const response = await fetch(transaction.type === "Income" ? "/api/monthly-income" : "/api/expense", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transaction),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not save transaction.");
          if (transaction.type === "Expense") setCorpus(previous => {
            const next = [...previous, { description: transaction.name, categoryId: transaction.categoryId }].slice(-100);
            try { localStorage.setItem("expenseCorpus", JSON.stringify(next)); } catch {}
            return next;
          });
        }}
        onTypedComplete={(count) => {
          showToast(`${count} ${count === 1 ? "transaction" : "transactions"} saved`, 2000);
          void refreshAffectedData().catch(error => showToast(error.message));
          setTimeout(() => { void refreshBudgetData().catch(() => {}); }, 1500);
        }}
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
        recentTransactions={scopedTransactions.filter((transaction) => (transactionType === "Income" ? transaction.type === "Income" : (!transaction.type || transaction.type === "Expense")) && transaction.id !== editingTransactionId).slice(0, 3)}
        lastUsedCatId={lastUsedCatId}
        displayedBalance={displayedBalance}
        amountAfterBalance={amountAfterBalance}
        parsedAmount={parsedAmount}
        categoryUnfunded={categoryUnfunded}
        categoryOverBudget={categoryOverBudget}
        categoryShortfall={budgetGate.shortfall}
        billShortfall={billShortfall}
        billsUnavailable={Boolean(billsError)}
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
          if (recurringBillId) showToast("Recurring bill saved. Finish its payment from Bills.", 3000);
          setRecurringBillId(null);
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
        onCloseCatPicker={() => setShowCatPicker(false)}
        onToggleAccountPicker={() => {
          setShowAccountPicker((v) => !v);
          setShowDatePicker(false);
          setShowCatPicker(false);
        }}
        onCloseAccountPicker={() => setShowAccountPicker(false)}
        onCloseDatePicker={() => setShowDatePicker(false)}
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
        onDelete={editingTransactionId ? () => deleteTransaction(editingTransactionId) : undefined}
        dateRef={dateRef}
        catRef={catRef}
        accountRef={accountRef}
      /></DeferredMount>

      <DeferredMount active={detailsTransaction !== null}>      <TransactionDetailsSheet
        transaction={detailsTransaction}
        accounts={accounts}
        categories={categories}
        onClose={() => setDetailsTransaction(null)}
      /></DeferredMount>

      <DeferredMount active={showCategoryDetails}>      <CategoryDetailsSheet
        open={showCategoryDetails}
        category={detailsCategory}
        month={(monthlySummary.start || today()).slice(0, 7)}
        accounts={displayAccounts}
        onClose={() => setShowCategoryDetails(false)}
        onOpenAdd={() => {
          if (detailsCategory) selectCategory(detailsCategory);
          setEditingTransactionId(null);
          setTransactionType("Expense");
          setShowCategoryDetails(false);
          setShowAddModal(true);
        }}
        onEdit={() => {
          setCategoryManageCategory(detailsCategory);
          setCategoryManageMode("edit");
          setShowCategoryDetails(false);
        }}
        onOpenFund={() => {
          if (detailsCategory) openFundCategory(detailsCategory);
        }}
        onTakeOut={detailsCategory && isSavingsCategory(detailsCategory) ? () => setWithdrawCategory(detailsCategory) : undefined}
        onFreeze={detailsCategory && !detailsCategory.snoozed ? () => freezeCategory(detailsCategory) : undefined}
        onUnfreeze={detailsCategory?.snoozed ? () => { void reviveCategory(detailsCategory, false); setShowCategoryDetails(false); } : undefined}
        onTransactionsChanged={refreshBudgetData}
      /></DeferredMount>

      <DeferredMount active={withdrawCategory !== null}>      <SavingsWithdrawSheet
        savings={withdrawCategory}
        destinations={withdrawCategory
          ? categories.filter((c) => !isSavingsCategory(c) && !c.archived && getCategoryScope(c, accounts) === getCategoryScope(withdrawCategory, accounts))
          : []}
        onClose={() => setWithdrawCategory(null)}
        onSuccess={(message) => { setShowCategoryDetails(false); void refreshBudgetData(message); }}
      /></DeferredMount>

      <DeferredMount active={categoryManageMode !== null}>      <CategoryManageSheet
        open={categoryManageMode !== null}
        mode={categoryManageMode ?? "fund"}
        category={categoryManageCategory}
        month={homeMonth}
        accounts={displayAccounts}
        defaultScope={budgetScope}
        availableTypes={availableCategoryTypes}
        defaultType={categoryManageDefaultType}
        onClose={() => setCategoryManageMode(null)}
        onSuccess={refreshBudgetData}
        zIndex={95}
      /></DeferredMount>

      {(accountDetailsLoaded || detailsAccount !== null) && <AccountDetailsSheet
        open={detailsAccount !== null}
        account={detailsAccount && (displayAccounts.find((a) => a.id === detailsAccount.id) ?? detailsAccount)}
        transactions={transactions}
        categories={categories}
        homeMonth={homeMonth}
        onClose={() => setDetailsAccount(null)}
        onMove={(acct) => { setDetailsAccount(null); setTransferPreset(null); setTransferAccount(acct); }}
        onIncome={(acct) => { setDetailsAccount(null); setIncomeAccount(acct); }}
        onReconcileSuccess={(msg) => { refreshAccountsData(msg); }}
        onTransactionsChanged={() => { fetchTransactions(); refreshBudgetData(); }}
      />}

      <DeferredMount active={incomeAccount !== null}>      <AccountIncomeSheet
        open={incomeAccount !== null}
        account={incomeAccount}
        onClose={() => setIncomeAccount(null)}
        onSuccess={refreshAccountsData}
      /></DeferredMount>

      <DeferredMount active={transferAccount !== null}>      <AccountTransferSheet
        open={transferAccount !== null}
        account={transferAccount}
        accounts={accounts}
        initialToAccountId={transferPreset?.toAccountId}
        initialAmount={transferPreset?.amount}
        initialNote={transferPreset?.note}
        onClose={() => { setTransferAccount(null); setTransferPreset(null); }}
        onSuccess={(message) => {
          refreshAccountsData(message);
          fetchTransactions();
          refreshBudgetData();
        }}
      /></DeferredMount>

      <DeferredMount active={showRebalance}>      <RebalanceSheet
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
      /></DeferredMount>

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
              <button type="button" onClick={() => { setAmount(draftOffer.amount); setName(draftOffer.name); setAccountId(accounts.some(a => a.id === draftOffer.accountId) ? draftOffer.accountId : ""); setCategoryId(categories.some(c => c.id === draftOffer.categoryId) ? draftOffer.categoryId : ""); setDate(draftOffer.date || today()); setRecurringRepeat(draftOffer.repeat === "Monthly" || draftOffer.repeat === "Yearly" ? draftOffer.repeat : "None"); setBudgetScope(draftOffer.scope); setDraftOffer(null); setShowAddModal(true); }} style={draftPrimaryButtonStyle}>Restore</button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}


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

/** Load sheet code on first use, then preserve drafts and exit animations. */
function DeferredMount({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [opened, setOpened] = useState(active);
  useEffect(() => { if (active) setOpened(true); }, [active]);
  return active || opened ? <>{children}</> : null;
}
