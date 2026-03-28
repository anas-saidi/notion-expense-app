"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Fuse from "fuse.js";
import { AppShell } from "./components/AppShell";
import { HomeScreen } from "./components/HomeScreen";
import { AddTransactionSheet } from "./components/AddTransactionSheet";
import { PickerPopover } from "./components/PickerPopover";
import type { Account, Category, PendingItem, Transaction } from "./components/app-types";
import { fmt, fmtDate, shiftDate, today } from "./components/app-utils";

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
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>{title}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{subtitle}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

export default function App() {
  const [mode, setMode] = useState<"wife" | "husband">("husband");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(FALLBACK_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "pending" | "history">("home");
  const [showAddModal, setShowAddModal] = useState(false);
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
  const [pendingName, setPendingName] = useState("");
  const [pendingAmount, setPendingAmount] = useState("");
  const [pendingCatId, setPendingCatId] = useState("");
  const [pendingDate, setPendingDate] = useState(today());
  const [addingPending, setAddingPending] = useState(false);
  const [showPendingCatPicker, setShowPendingCatPicker] = useState(false);
  const [pendingCatSearch, setPendingCatSearch] = useState("");
  const [corpus, setCorpus] = useState<{ description: string; categoryId: string }[]>([]);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);

  const initialAcctApplied = useRef(false);
  const initialCatApplied = useRef(false);
  const loadedPendingId = useRef<string | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balanceAnimRef = useRef<number | null>(null);
  const fuseRef = useRef<Fuse<{ description: string; categoryId: string }> | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const pendingCatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    const savedMode = localStorage.getItem("mode") as "wife" | "husband" | null;
    if (savedMode) setMode(savedMode);
  }, []);

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

  const toggleMode = () => {
    const next = mode === "wife" ? "husband" : "wife";
    setMode(next);
    localStorage.setItem("mode", next);
    applyDefaultAccountForMode(accounts, next);
  };

  const fetchTransactions = async () => {
    const data = await fetch("/api/transactions").then((r) => r.json());
    const txns: Transaction[] = data.transactions ?? [];
    setTransactions(txns);
    const latestCat = txns[0]?.category;
    if (latestCat) setLastUsedCatId(latestCat);
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
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatPicker(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setShowAccountPicker(false);
      if (pendingCatRef.current && !pendingCatRef.current.contains(e.target as Node)) setShowPendingCatPicker(false);
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

  const addPending = async () => {
    if (!pendingName.trim()) return;
    setAddingPending(true);
    const optimistic: PendingItem = {
      id: `tmp-${Date.now()}`,
      name: pendingName.trim(),
      amount: pendingAmount ? parseFloat(pendingAmount) : null,
      categoryId: pendingCatId || null,
      addedBy: mode === "wife" ? "Wife" : "Husband",
      date: pendingDate || null,
    };
    setPendingItems((prev) => [...prev, optimistic]);
    setPendingName("");
    setPendingAmount("");
    setPendingCatId("");
    setPendingDate(today());

    try {
      const data = await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optimistic),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to save");
        return json;
      });
      setPendingItems((prev) => {
        const updated = prev.map((p) => (p.id === optimistic.id ? { ...p, id: data.id } : p));
        localStorage.setItem("pendingItems", JSON.stringify(updated));
        return updated;
      });
      showToast("Wishlist updated");
    } catch (e: unknown) {
      setPendingItems((prev) => prev.filter((p) => p.id !== optimistic.id));
      showToast(`Failed to save - ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setAddingPending(false);
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
        if (!r.ok) fetchTransactions();
      });
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

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
  const totalAvailable = categories.reduce((sum, c) => sum + (c.available ?? 0), 0);
  const suggestedCategory = suggestedCatId ? categories.find((c) => c.id === suggestedCatId) : undefined;

  const modeButton = (
    <button onClick={toggleMode} style={modeButtonStyle}>
      <span style={{ fontSize: 14 }}>{mode === "wife" ? "W" : "H"}</span>
      <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>
        {mode === "wife" ? "Wife" : "Hubby"}
      </span>
    </button>
  );

  return (
    <AppShell tab={tab} pendingCount={pendingItems.length} onTabChange={setTab} onOpenAdd={() => setShowAddModal(true)} toast={microToast} mode={mode}>
      {tab === "home" && (
        <HomeScreen
          categories={homeCategories}
          selectedCategoryId={categoryId}
          search={homeSearch}
          onSearchChange={setHomeSearch}
          onSelectCategory={selectCategory}
          onOpenAdd={() => setShowAddModal(true)}
          totalAvailable={totalAvailable}
        />
      )}

      {tab === "pending" && (
        <div id="panel-pending" role="tabpanel" aria-labelledby="tab-pending">
          <SectionHeader title="Pending" subtitle="Save ideas now and turn them into real expenses later." action={modeButton} />
          <div style={{ display: "grid", gap: 12 }}>
            <div style={surfaceStyle}>
              <div style={{ display: "grid", gap: 10 }}>
                <input type="text" value={pendingName} onChange={(e) => setPendingName(e.target.value)} placeholder="Want to buy..." style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                  <input type="text" inputMode="decimal" value={pendingAmount} onChange={(e) => setPendingAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount" style={inputStyle} />
                  <div style={{ position: "relative" }} ref={pendingCatRef}>
                    <button onClick={() => setShowPendingCatPicker((v) => !v)} style={{ ...chipPickerStyle, width: 48, justifyContent: "center", padding: 0 }}>
                      {pendingCatId ? (categories.find((c) => c.id === pendingCatId)?.icon ?? "#") : "#"}
                    </button>
                    <PickerPopover open={showPendingCatPicker} align="right" placement="top" width="min(240px, calc(100vw - 72px))">
                      <div style={{ maxHeight: 220, overflowY: "auto", padding: 8 }}>
                        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                          <input type="text" value={pendingCatSearch} onChange={(e) => setPendingCatSearch(e.target.value)} placeholder="Search categories" style={{ ...inputStyle, background: "transparent", border: "none", padding: 0 }} />
                        </div>
                        <button onClick={() => { setPendingCatId(""); setShowPendingCatPicker(false); setPendingCatSearch(""); }} style={pickerListButtonStyle}>No category</button>
                        {categories.filter((c) => c.name.toLowerCase().includes(pendingCatSearch.toLowerCase())).map((cat) => (
                          <button key={cat.id} onClick={() => { setPendingCatId(cat.id); setShowPendingCatPicker(false); setPendingCatSearch(""); }} style={pickerListButtonStyle}>
                            <span>{cat.icon ?? "#"}</span>
                            <span>{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </PickerPopover>
                  </div>
                  <button onClick={addPending} disabled={!pendingName.trim() || addingPending} style={{ ...ctaSmallStyle, opacity: pendingName.trim() ? 1 : 0.45 }}>
                    {addingPending ? "..." : "Add"}
                  </button>
                </div>
                <input type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {pendingItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                return (
                  <div key={item.id} style={{ ...surfaceStyle, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={iconBadgeStyle}>{cat?.icon ?? "#"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                        {[item.date ? fmtDate(item.date) : null, cat?.name, item.addedBy].filter(Boolean).join(" / ")}
                      </div>
                    </div>
                    {item.amount !== null && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text2)" }}>{fmt(item.amount)}</span>}
                    <button onClick={() => loadPending(item)} style={ghostActionStyle}>Fill</button>
                    <button onClick={() => dismissPending(item.id)} style={ghostActionStyle}>x</button>
                  </div>
                );
              })}

              {pendingItems.length === 0 && (
                <div style={{ ...surfaceStyle, color: "var(--muted)", fontSize: 14 }}>Nothing pending. Future-you says thanks.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history">
          <SectionHeader title="History" subtitle="Recent spending, ready to review or reuse." action={modeButton} />
          <div style={{ display: "grid", gap: 8 }}>
            {transactions.map((t) => {
              const cat = categories.find((c) => c.id === t.category);
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (deletingId === t.id) return;
                    setName(t.name);
                    if (t.category) {
                      const found = categories.find((x) => x.id === t.category);
                      if (found) selectCategory(found);
                    }
                    setShowAddModal(true);
                  }}
                  style={{ ...surfaceStyle, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderColor: deletingId === t.id ? "var(--danger)" : "var(--border)" }}
                >
                  <div style={iconBadgeStyle}>{cat?.icon ?? "#"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                      {[cat?.name ?? "Unsorted", fmtDate(t.date)].join(" / ")}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--danger)" }}>-{fmt(t.amount)}</div>
                  <button onClick={(e) => { e.stopPropagation(); deleteTransaction(t.id); }} style={{ ...ghostActionStyle, color: deletingId === t.id ? "var(--surface)" : "var(--muted)", background: deletingId === t.id ? "var(--danger)" : "transparent" }}>
                    Del
                  </button>
                </div>
              );
            })}

            {transactions.length === 0 && (
              <div style={{ ...surfaceStyle, color: "var(--muted)", fontSize: 14 }}>No transactions yet.</div>
            )}
          </div>
        </div>
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
    </AppShell>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
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
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 16,
};

const modeButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 20,
  border: "1px solid var(--border2)",
  background: "var(--surface)",
  cursor: "pointer",
  color: "var(--text2)",
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
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
  background: "var(--accent)",
  color: "#0d1117",
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
