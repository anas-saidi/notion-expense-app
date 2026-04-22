"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Fuse from "fuse.js";
import { AppShell } from "./components/AppShell";
import { HomeScreen } from "./components/HomeScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { PendingScreen } from "./components/PendingScreen";
import { MonthlyPlanningFlow } from "./components/MonthlyPlanningFlow";
import { AddTransactionSheet } from "./components/AddTransactionSheet";
import { CategoryDetailsSheet } from "./components/CategoryDetailsSheet";
import { Money } from "./components/Money";
import { PickerPopover } from "./components/PickerPopover";
import type { Account, Category, MonthlySummary, PendingItem, Transaction } from "./components/app-types";
import { fmtDate, monthBounds, shiftDate, today } from "./components/app-utils";

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

const isSavingsAccount = (account: Account) => {
  const value = account.type?.toLowerCase() ?? "";
  return value.includes("saving");
};

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
  const mode = "husband" as const;
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [tab, setTab] = useState<"home" | "plan" | "pending" | "history">("home");
  const [plannerMonth, setPlannerMonth] = useState(formatMonthInput(today()));
  const [plannerSummaryReady, setPlannerSummaryReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);
  const [homeSearch, setHomeSearch] = useState("");

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<{ description: string; categoryId: string }[]>([]);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);
  const [plannedByCategory, setPlannedByCategory] = useState<Record<string, number>>({});
  const [readyToAssignOffset, setReadyToAssignOffset] = useState<{ household: number; wife: number; husband: number }>({
    household: 0,
    wife: 0,
    husband: 0,
  });

  const initialAcctApplied = useRef(false);
  const initialCatApplied = useRef(false);
  const plannerMonthHydrated = useRef(false);
  const loadedPendingId = useRef<string | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planUpdateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const balanceAnimRef = useRef<number | null>(null);
  const fuseRef = useRef<Fuse<{ description: string; categoryId: string }> | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, []);

  const showToast = (msg: string, timeout = 1400) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMicroToast(msg);
    toastTimerRef.current = setTimeout(() => setMicroToast(null), timeout);
  };

  const applyDefaultAccountForMode = (accs: Account[], nextMode = mode) => {
    const keyword = nextMode === "wife" ? "wife" : "hubb";
    const match = accs.find((a) => a.label.toLowerCase().includes(keyword));
    setAccountId((match ?? accs[0])?.id ?? "");
  };

  const fetchTransactions = async () => {
    const data = await fetch("/api/transactions?page_size=100").then((r) => r.json());
    const txns: Transaction[] = data.transactions ?? [];
    setTransactions(txns);
    const latestCat = txns[0]?.category;
    if (latestCat) setLastUsedCatId(latestCat);
  };

  const fetchMonthlySummary = async () => {
    try {
      const { start, end } = monthBounds(today());
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

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        if (data.categories?.length > 0) setCategoryId(data.categories[0].id);
      })
      .finally(() => setLoading(false));

    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        const accs: Account[] = data.accounts ?? [];
        setAccounts(accs);
        applyDefaultAccountForMode(accs, mode);
      });

    fetchTransactions();
    fetchPending();
    fetchMonthlySummary();
  }, []);

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
    const { start, end } = monthBounds(`${plannerMonth}-01`);

    fetch(`/api/monthly-summary?start=${start}&end=${end}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load planner summary");
        await res.json();
        if (!cancelled) setPlannerSummaryReady(true);
      })
      .catch(() => {
        if (!cancelled) setPlannerSummaryReady(false);
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

  const addPendingItem = async (data: { name: string; amount: number | null; categoryId: string | null; addedBy: string; date: string | null }) => {
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

  const deleteTransaction = async (id: string) => {
    if (deletingId !== id) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeletingId(id);
      deleteTimerRef.current = setTimeout(() => setDeletingId(null), 2000);
      return;
    }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletingId(null);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then((r) => {
        if (!r.ok) {
          fetchTransactions();
          return;
        }
        fetchMonthlySummary();
      });
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const plannerUsesFallbackData =
    !plannerSummaryReady || plannerMonth !== formatMonthInput(today());

  const readyToAssignPool = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        if (isSavingsAccount(account)) return sum;
        return sum + (account.readyToAssign ?? 0);
      }, 0),
    [accounts],
  );

  const readyToAssignByScope = useMemo(() => {
    const norm = (value: string) => value.toLowerCase();
    const applyJointDue = (account: Account) => {
      const base = account.readyToAssign ?? 0;
      const jointDue = account.jointDue ?? 0;
      if (jointDue <= 0) return base;
      return base - jointDue;
    };
    const wifeTotal = accounts.reduce((sum, account) => {
      if (isSavingsAccount(account)) return sum;
      if (!norm(account.label).includes("wife")) return sum;
      return sum + applyJointDue(account);
    }, 0);
    const husbandTotal = accounts.reduce((sum, account) => {
      if (isSavingsAccount(account)) return sum;
      if (!norm(account.label).includes("hubb")) return sum;
      return sum + applyJointDue(account);
    }, 0);

    return {
      household: readyToAssignPool + readyToAssignOffset.household,
      wife: Math.max(0, wifeTotal + readyToAssignOffset.wife),
      husband: Math.max(0, husbandTotal + readyToAssignOffset.husband),
    };
  }, [accounts, readyToAssignOffset, readyToAssignPool]);

  const contributionDueByScope = useMemo(() => {
    const norm = (value: string) => value.toLowerCase();
    let wifeDue = 0;
    let husbandDue = 0;

    for (const account of accounts) {
      if (isSavingsAccount(account)) continue;
      const label = norm(account.label);
      const due = Math.max(0, account.jointDue ?? 0);
      if (!due) continue;
      if (label.includes("wife")) wifeDue += due;
      if (label.includes("hubb")) husbandDue += due;
    }

    return {
      wife: wifeDue,
      husband: husbandDue,
      total: wifeDue + husbandDue,
    };
  }, [accounts]);

  const householdSpentByPartner = useMemo(() => {
    const householdCategoryIds = new Set(
      categories.filter((category) => category.isTeamFund).map((category) => category.id),
    );
    const accountLabelById = new Map(
      accounts.map((account) => [account.id, account.label.toLowerCase()]),
    );
    const bounds = monthlySummary.start && monthlySummary.end
      ? { start: monthlySummary.start, end: monthlySummary.end }
      : monthBounds(today());
    const startDate = new Date(bounds.start);
    const endDate = new Date(bounds.end);

    let wife = 0;
    let husband = 0;
    let other = 0;

    for (const txn of transactions) {
      if (!txn.category || !householdCategoryIds.has(txn.category)) continue;
      if (!txn.date) continue;
      const txnDate = new Date(txn.date);
      if (txnDate < startDate || txnDate > endDate) continue;
      const amount = txn.amount ?? 0;
      const label = txn.accountId ? accountLabelById.get(txn.accountId) ?? "" : "";
      if (label.includes("wife")) {
        wife += amount;
      } else if (label.includes("hubb")) {
        husband += amount;
      } else {
        other += amount;
      }
    }

    return {
      wife,
      husband,
      other,
      total: wife + husband + other,
    };
  }, [accounts, categories, monthlySummary.end, monthlySummary.start, transactions]);

  const totalPlanned = useMemo(
    () => categories.reduce((sum, category) => sum + (category.planned ?? 0), 0),
    [categories],
  );

  const poolRemaining = Math.max(0, readyToAssignPool - totalPlanned);

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
    selectCategory(cat);
    setShowCategoryDetails(true);
  };

  const filteredCats = categories
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

  const resolveCategoryScope = (category: Category): "household" | "wife" | "husband" => {
    if (category.isTeamFund) return "household";
    const owner = category.owner?.toLowerCase() ?? "";
    if (owner.includes("salma")) return "wife";
    if (owner.includes("anas")) return "husband";
    return "household";
  };

  const handlePlannedChange = (categoryId: string, nextPlanned: number) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    const currentPlanned = plannedByCategory[categoryId] ?? category.planned ?? 0;
    if (nextPlanned === currentPlanned) return;
    const delta = nextPlanned - currentPlanned;
    const scope = resolveCategoryScope(category);

    const spent = monthlySummary.spentByCategory.find((item) => item.categoryId === categoryId)?.total ?? 0;

    setPlannedByCategory((prev) => ({
      ...prev,
      [categoryId]: nextPlanned,
    }));

    setCategories((prev) =>
      prev.map((item) => {
        if (item.id !== categoryId) return item;
        const nextAvailable = typeof item.available === "number"
          ? Math.max(0, nextPlanned - spent)
          : item.available;
        return { ...item, planned: nextPlanned, available: nextAvailable };
      }),
    );

    setMonthlySummary((prev) => {
      const nextAssignedByCategory = [...prev.assignedByCategory];
      const entryIndex = nextAssignedByCategory.findIndex((item) => item.categoryId === categoryId);
      if (entryIndex >= 0) {
        nextAssignedByCategory[entryIndex] = { ...nextAssignedByCategory[entryIndex], total: nextPlanned };
      } else {
        nextAssignedByCategory.push({ categoryId, total: nextPlanned });
      }
      const nextTotalAssigned = nextAssignedByCategory.reduce((sum, item) => sum + item.total, 0);
      return {
        ...prev,
        totalAssigned: nextTotalAssigned,
        assignedByCategory: nextAssignedByCategory,
      };
    });

    setReadyToAssignOffset((prev) => ({
      ...prev,
      [scope]: prev[scope] - delta,
    }));

    if (!/^\d{4}-\d{2}$/.test(plannerMonth)) return;
    if (planUpdateTimersRef.current[categoryId]) {
      clearTimeout(planUpdateTimersRef.current[categoryId]);
    }

    planUpdateTimersRef.current[categoryId] = setTimeout(() => {
      const reverse = delta < 0;
      const planned = Math.abs(delta);
      if (planned === 0) return;
      fetch("/api/monthly-planning/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: plannerMonth,
          categoryId,
          planned,
          accountId: category.defaultAccount ?? null,
          reverse,
        }),
      })
        .then((res) => res.json())
        .catch(() => null);
    }, 450);
  };

  const submit = async () => {
    if (!amount || !name || !categoryId) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount: parseFloat(amount), accountId, categoryId, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setStatus("success");
      setShowSaveBurst(true);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => setShowSaveBurst(false), 850);
      showToast(SAVE_LINES[Math.floor(Math.random() * SAVE_LINES.length)], 1500);

      const newEntry = { description: name.trim(), categoryId };
      setCorpus((prev) => {
        const updated = [...prev, newEntry].slice(-100);
        localStorage.setItem("expenseCorpus", JSON.stringify(updated));
        return updated;
      });

      const expAmt = parseFloat(amount);
      if (displayedBalance !== null) animateBalance(displayedBalance, displayedBalance - expAmt);
      fetchTransactions();
      fetchMonthlySummary();
      fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));

      if (loadedPendingId.current) {
        dismissPending(loadedPendingId.current);
        loadedPendingId.current = null;
      }

      setAmount("");
      setName("");
      setSuggestedCatId(null);
      setDate(today());
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  if (loading) {
    return (
      <div data-mode={mode} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 11, letterSpacing: 0.2, color: "var(--muted)", fontWeight: 600, animation: "fadeUp 0.2s ease both" }}>
            {LOADING_LINES[loadingLineIdx]}
          </p>
        </div>
      </div>
    );
  }

  const parsedAmount = amount ? parseFloat(amount) : 0;
  const categoryUnfunded = !!(selectedCat && selectedCat.available !== null && selectedCat.available === 0);
  const categoryOverBudget = !!(selectedCat && selectedCat.available !== null && selectedCat.available > 0 && parsedAmount > selectedCat.available);
  const canSubmit = Boolean(amount && parsedAmount > 0 && name.trim() && categoryId && status === "idle" && !categoryUnfunded && !categoryOverBudget);
  const suggestedCategory = suggestedCatId ? categories.find((c) => c.id === suggestedCatId) : undefined;

  return (
    <AppShell
      tab={tab}
      pendingCount={pendingItems.length}
      onTabChange={setTab}
      onOpenAdd={() => setShowAddModal(true)}
      toast={microToast}
      mode={mode}
      showAddButton={tab !== "plan"}
      immersive={tab === "plan"}
    >
      {tab === "home" && (
        <HomeScreen
          categories={homeCategories}
          selectedCategoryId={categoryId}
          search={homeSearch}
          onSearchChange={setHomeSearch}
          onSelectCategory={selectCategory}
          onOpenCategoryDetails={openCategoryDetails}
          onOpenAdd={() => setShowAddModal(true)}
          onOpenPlan={() => setTab("plan")}
          monthlySummary={monthlySummary}
          onPlannedChange={handlePlannedChange}
          readyToAssignByScope={readyToAssignByScope}
          contributionDueByScope={contributionDueByScope}
          householdSpentByPartner={householdSpentByPartner}
        />
      )}

      {tab === "plan" && (
        <MonthlyPlanningFlow
          selectedMonth={plannerMonth}
          onSelectedMonthChange={setPlannerMonth}
          onCancel={() => setTab("home")}
          onOpenAddTransaction={({ accountId: nextAccountId, amount: nextAmount, name: nextName }) => {
            setAccountId(nextAccountId);
            setAmount(String(nextAmount));
            setName(nextName ?? "");
            setDate(today());
            setShowAddModal(true);
          }}
          accounts={accounts}
          categories={categories}
          isUsingFallbackData={plannerUsesFallbackData}
        />
      )}

      {tab === "pending" && (
        <PendingScreen
          pendingItems={pendingItems}
          categories={categories}
          mode={mode}
          onLogItem={loadPending}
          onDismiss={dismissPending}
          onAdd={addPendingItem}
        />
      )}

      {tab === "history" && (
        <HistoryScreen
          transactions={transactions}
          categories={categories}
          deletingId={deletingId}
          onClickTransaction={(t) => {
            setName(t.name);
            if (t.category) {
              const found = categories.find((x) => x.id === t.category);
              if (found) selectCategory(found);
            }
            setShowAddModal(true);
          }}
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
        onClose={() => setShowAddModal(false)}
        onAmountChange={(value) => {
          const cleaned = value.replace(/[^0-9.]/g, "");
          if ((cleaned.match(/\./g) || []).length <= 1) setAmount(cleaned);
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
        category={selectedCat ?? null}
        month={(monthlySummary.start || today()).slice(0, 7)}
        onClose={() => setShowCategoryDetails(false)}
        onOpenAdd={() => {
          setShowCategoryDetails(false);
          setShowAddModal(true);
        }}
      />

    </AppShell>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid transparent",
  borderRadius: 14,
  padding: "13px 16px",
  color: "var(--text)",
  fontSize: 16,
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
};

const surfaceStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--card-radius)",
  boxShadow: "var(--card-shadow)",
  padding: 16,
};

const chipPickerStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const pickerListButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 12,
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "left",
};

const ctaSmallStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  cursor: "pointer",
};

const iconBadgeStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: "var(--surface2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 16,
};

const ghostActionStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};
