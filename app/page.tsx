"use client";

import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string; icon: string | null; type: string[]; defaultAccount: string | null; available: number | null; planned: number | null };
type Transaction = { id: string; name: string; amount: number; date: string; category: string | null };
type Account = { id: string; label: string; icon: string; type: string | null; balance: number | null };
type PendingItem = { id: string; name: string; amount: number | null; categoryId: string | null; addedBy: string | null; date: string | null };

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

// ─── Accounts (static — pulled from your Notion) ─────────────────────────
const FALLBACK_ACCOUNTS: Account[] = [];

const today = () => new Date().toISOString().split("T")[0];
const fmt = (n: number) => n.toLocaleString("fr-MA");
const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState<"wife" | "husband">("husband");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(FALLBACK_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"add" | "pending" | "history">("add");

  // Form state
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);
  const [showSaveBurst, setShowSaveBurst] = useState(false);
  const [microToast, setMicroToast] = useState<string | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [lastUsedCatId, setLastUsedCatId] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const balanceAnimRef = useRef<number | null>(null);
  const catRef = useRef<HTMLDivElement>(null);

  const initialAcctApplied = useRef(false);
  // Pending purchases state
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingName, setPendingName] = useState("");
  const [pendingAmount, setPendingAmount] = useState("");
  const [pendingCatId, setPendingCatId] = useState("");
  const [addingPending, setAddingPending] = useState(false);
  const [showPendingCatPicker, setShowPendingCatPicker] = useState(false);
  const [pendingCatSearch, setPendingCatSearch] = useState("");
  const [pendingDate, setPendingDate] = useState(today());
  const pendingCatRef = useRef<HTMLDivElement>(null);
  const loadedPendingId = useRef<string | null>(null);
  const initialCatApplied = useRef(false);

  // Auto-suggest state
  const [corpus, setCorpus] = useState<{ description: string; categoryId: string }[]>([]);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuseRef = useRef<Fuse<{ description: string; categoryId: string }> | null>(null);

  // Sync mode to <html> so CSS vars apply to body, body::before, etc.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []);

  // Load saved mode
  useEffect(() => {
    const savedMode = localStorage.getItem("mode") as "wife" | "husband" | null;
    if (savedMode) setMode(savedMode);
  }, []);

  const toggleMode = () => {
    const next = mode === "wife" ? "husband" : "wife";
    setMode(next);
    localStorage.setItem("mode", next);
    // Re-apply default account for the new mode
    if (accounts.length > 0) {
      const keyword = next === "wife" ? "wife" : "hubb";
      const match = accounts.find(a => a.label.toLowerCase().includes(keyword));
      setAccountId((match ?? accounts[0]).id);
    }
  };

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories ?? []);
        if (data.categories?.length > 0) setCategoryId(data.categories[0].id);
      })
      .finally(() => setLoading(false));

    fetch("/api/accounts")
      .then(r => r.json())
      .then(data => {
        const accs: Account[] = data.accounts ?? [];
        setAccounts(accs);
        // Default: Wife Account for wife mode, Hubby Account for husband mode
        const keyword = mode === "wife" ? "wife" : "hubb";
        const match = accs.find(a => a.label.toLowerCase().includes(keyword));
        setAccountId((match ?? accs[0])?.id ?? "");
      });

    fetchTransactions();
    fetchPending();

    // lastUsedCatId is set from API transactions in fetchTransactions
  }, []);

  // Set last used category on initial load (as soon as categories + transactions are ready)
  useEffect(() => {
    if (initialCatApplied.current) return;
    if (!lastUsedCatId || !categories.length) return;
    const cat = categories.find(c => c.id === lastUsedCatId);
    if (!cat) return;
    initialCatApplied.current = true;
    setCategoryId(cat.id);
  }, [lastUsedCatId, categories]);

  // Apply the selected category's default account once accounts are ready (initial load only)
  useEffect(() => {
    if (initialAcctApplied.current) return;
    if (!accounts.length || !categories.length || !categoryId) return;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat?.defaultAccount) { initialAcctApplied.current = true; return; }
    const normId = (id: string) => id.replace(/-/g, "").toLowerCase();
    const acct = accounts.find(a => normId(a.id) === normId(cat.defaultAccount!));
    if (acct) setAccountId(acct.id);
    initialAcctApplied.current = true;
  }, [categoryId, categories, accounts]);

  // Load or seed the auto-suggest corpus
  useEffect(() => {
    const raw = localStorage.getItem("expenseCorpus");
    if (raw) {
      try { setCorpus(JSON.parse(raw)); } catch {}
    } else {
      fetch("/api/transactions?page_size=50")
        .then(r => r.json())
        .then(data => {
          const entries: { description: string; categoryId: string }[] = (data.transactions ?? [])
            .filter((t: Transaction) => t.name && t.category)
            .map((t: Transaction) => ({ description: t.name, categoryId: t.category as string }));
          setCorpus(entries);
          localStorage.setItem("expenseCorpus", JSON.stringify(entries));
        })
        .catch(() => {});
    }
  }, []);

  // Rebuild Fuse index whenever corpus changes
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
    const id = setInterval(() => {
      setLoadingLineIdx(i => (i + 1) % LOADING_LINES.length);
    }, 900);
    return () => clearInterval(id);
  }, [loading]);

  const showToast = (msg: string, timeout = 1400) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMicroToast(msg);
    toastTimerRef.current = setTimeout(() => setMicroToast(null), timeout);
  };

  const fetchTransactions = async () => {
    const data = await fetch("/api/transactions").then(r => r.json());
    const txns: Transaction[] = data.transactions ?? [];
    setTransactions(txns);
    const latestCat = txns[0]?.category;
    if (latestCat) setLastUsedCatId(latestCat);
  };

  const fetchPending = async () => {
    // Show cached items instantly while the network request is in-flight
    try {
      const cached = localStorage.getItem("pendingItems");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setPendingItems(parsed);
      }
    } catch {}
    try {
      const res = await fetch("/api/pending");
      if (!res.ok) return; // keep cached items on API error
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setPendingItems(data.items);
        localStorage.setItem("pendingItems", JSON.stringify(data.items));
      }
    } catch {
      // silently keep cached items if fetch fails
    }
  };

  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories ?? [])),
        fetch("/api/accounts").then(r => r.json()).then(d => setAccounts(d.accounts ?? [])),
        fetch("/api/transactions").then(r => r.json()).then(d => setTransactions(d.transactions ?? [])),
        fetch("/api/pending").then(r => r.ok ? r.json() : null).then(d => { if (d && Array.isArray(d.items)) setPendingItems(d.items); }).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const addPending = async () => {
    if (!pendingName.trim()) return;
    setAddingPending(true);
    const optimistic: PendingItem = { id: `tmp-${Date.now()}`, name: pendingName.trim(), amount: pendingAmount ? parseFloat(pendingAmount) : null, categoryId: pendingCatId || null, addedBy: mode === "wife" ? "Wife" : "Husband", date: pendingDate || null };
    setPendingItems(prev => [...prev, optimistic]);
    setPendingName(""); setPendingAmount(""); setPendingCatId(""); setPendingDate(today());
    try {
      const data = await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: optimistic.name, amount: optimistic.amount, categoryId: optimistic.categoryId, addedBy: optimistic.addedBy, date: optimistic.date }),
      }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to save");
        return json;
      });
      // Replace optimistic with real Notion id and persist to localStorage
      setPendingItems(prev => {
        const updated = prev.map(p => p.id === optimistic.id ? { ...p, id: data.id } : p);
        localStorage.setItem("pendingItems", JSON.stringify(updated));
        return updated;
      });
      showToast("Wishlist updated");
    } catch (e: unknown) {
      setPendingItems(prev => {
        const updated = prev.filter(p => p.id !== optimistic.id);
        localStorage.setItem("pendingItems", JSON.stringify(updated));
        return updated;
      });
      const msg = e instanceof Error ? e.message : "Failed to save";
      showToast(`Failed to save — ${msg}`);
    } finally {
      setAddingPending(false);
    }
  };

  const loadPending = (item: PendingItem) => {
    setName(item.name);
    if (item.amount !== null) setAmount(String(item.amount));
    if (item.date) setDate(item.date);
    if (item.categoryId) {
      const cat = categories.find(c => c.id === item.categoryId);
      if (cat) selectCategory(cat);
    }
    loadedPendingId.current = item.id;
    setTab("add");
    showToast("Loaded into Add form", 1200);
  };

  const dismissPending = async (id: string) => {
    setPendingItems(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem("pendingItems", JSON.stringify(updated));
      return updated;
    });
    fetch("/api/pending", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then(r => { if (!r.ok) fetchPending(); });
  };

  const deleteTransaction = async (id: string) => {
    if (deletingId !== id) {
      // First tap: enter confirm state, auto-reset after 2s
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeletingId(id);
      deleteTimerRef.current = setTimeout(() => setDeletingId(null), 2000);
      return;
    }
    // Second tap: confirmed — optimistic remove then archive in Notion
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletingId(null);
    setTransactions(prev => prev.filter(t => t.id !== id));
    fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(r => { if (!r.ok) fetchTransactions(); }); // re-fetch if failed
  };

  // Sync displayedBalance when selected account or accounts list changes
  useEffect(() => {
    const acct = accounts.find(a => a.id === accountId);
    if (acct?.balance != null) setDisplayedBalance(acct.balance);
    else setDisplayedBalance(null);
  }, [accountId, accounts]);

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

  // Close cat pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatPicker(false);
      if (pendingCatRef.current && !pendingCatRef.current.contains(e.target as Node)) setShowPendingCatPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedCat = categories.find(c => c.id === categoryId);

  // When category changes, auto-select its default account
  const selectCategory = (cat: Category) => {
    setCategoryId(cat.id);
    setLastUsedCatId(cat.id);
    if (cat.defaultAccount) {
      const normId = (id: string) => id.replace(/-/g, "").toLowerCase();
      const acct = accounts.find(a => normId(a.id) === normId(cat.defaultAccount!));
      if (acct) setAccountId(acct.id);
    }
    setShowCatPicker(false);
    setCatSearch("");
  };

  const filteredCats = categories
    .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.id === lastUsedCatId) return -1;
      if (b.id === lastUsedCatId) return 1;
      return 0;
    });

  const suggestCategory = (query: string) => {
    if (!fuseRef.current || query.length < 3) { setSuggestedCatId(null); return; }
    const results = fuseRef.current.search(query);
    if (results.length === 0) { setSuggestedCatId(null); return; }
    const tally: Record<string, { weight: number; count: number }> = {};
    for (const r of results) {
      const catId = r.item.categoryId;
      const weight = 1 - (r.score ?? 1);
      if (!tally[catId]) tally[catId] = { weight: 0, count: 0 };
      tally[catId].weight += weight;
      tally[catId].count += 1;
    }
    const best = Object.entries(tally)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].weight - a[1].weight)[0];
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
      // Grow corpus with this entry for future suggestions
      const newEntry = { description: name.trim(), categoryId };
      setCorpus(prev => {
        const updated = [...prev, newEntry].slice(-100);
        localStorage.setItem("expenseCorpus", JSON.stringify(updated));
        return updated;
      });
      // Animate balance countdown then re-fetch real value
      const expAmt = parseFloat(amount);
      if (displayedBalance !== null) animateBalance(displayedBalance, displayedBalance - expAmt);
      fetchTransactions();
      fetch("/api/accounts").then(r => r.json()).then(d => setAccounts(d.accounts ?? []));

      // Auto-dismiss the pending item that was loaded into the form
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

  // ── Loading
  if (loading) return (
    <div data-mode={mode} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 11, letterSpacing: 0.2, color: "var(--muted)", fontWeight: 600, animation: "fadeUp 0.2s ease both" }}>
          {LOADING_LINES[loadingLineIdx]}
        </p>
      </div>
    </div>
  );

  const categoryUnfunded = !!(selectedCat && selectedCat.available !== null && selectedCat.available === 0);
  const parsedAmount = amount ? parseFloat(amount) : 0;
  const categoryOverBudget = !!(selectedCat && selectedCat.available !== null && selectedCat.available > 0 && parsedAmount > selectedCat.available);
  const canSubmit = amount && parsedAmount > 0 && name.trim() && categoryId && status === "idle" && !categoryUnfunded && !categoryOverBudget;

  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(var(--safe-top) + 20px) 20px calc(72px + env(safe-area-inset-bottom, 0px))" }}>

        {/* ── ADD TAB ── */}
        <div id="panel-add" role="tabpanel" aria-labelledby="tab-add" style={{ display: tab === "add" ? "block" : "none" }}>

        {/* ── Header */}
        <header style={{ marginBottom: 30, animation: "fadeUp 0.4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ position: "relative" }}>
              <p style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent)", marginBottom: 4, fontWeight: 700, transition: "color 0.35s ease" }}>
                Notion Finance
              </p>
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(35px, 10vw, 48px)", lineHeight: 0.95, color: "var(--text)", letterSpacing: -0.5 }}>
                Add <em style={{ fontStyle: "italic", color: "var(--accent)", transition: "color 0.35s ease" }}>expense</em>
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Global refresh */}
              <button
                onClick={refreshAll}
                disabled={refreshing}
                aria-label="Refresh all data"
                title="Refresh all"
                style={{ background: "none", border: "none", cursor: refreshing ? "default" : "pointer", color: "var(--muted)", width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", opacity: refreshing ? 0.5 : 1, transition: "opacity 0.2s, color 0.2s" }}
                onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none" }}>
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              {/* Mode toggle */}
              <button
                onClick={toggleMode}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--border2)",
                  background: "var(--surface2)",
                  cursor: "pointer",
                  color: "var(--text2)",
                  fontSize: 13,
                  transition: "all 0.35s ease",
                  animation: "modeIn 0.3s ease both",
                }}
                title={`Switch to ${mode === 'wife' ? 'Husband' : 'Wife'} mode`}
              >
                <span style={{ fontSize: 15 }}>{mode === "wife" ? "🎀" : "👨‍💻"}</span>
                <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>
                  {mode === "wife" ? "Wife" : "Hubby"}
                </span>
              </button>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {mode === "wife" ? "💎" : "💸"}
              </div>
            </div>
          </div>
        </header>

        {/* ── Date + Today summary */}
        {(() => {
          const todayStr = today();
          const isToday = date === todayStr;
          const todayTxs = transactions.filter(t => t.date === todayStr);
          const todayTotal = todayTxs.reduce((s, t) => s + t.amount, 0);
          return (
            <div style={{ marginBottom: 14, animation: "fadeUp 0.4s 0.03s ease both", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid var(--border)", gap: 12 }}>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16, fontFamily: "'DM Mono', monospace", colorScheme: mode === "wife" ? "light" : "dark", cursor: "pointer", padding: 0, flexShrink: 0, letterSpacing: 0.5 }}
              />
              {isToday && todayTxs.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{todayTxs.length} expense{todayTxs.length !== 1 ? "s" : ""}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>−{fmt(todayTotal)} MAD</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Today category chips */}
        {(() => {
          const todayStr = today();
          if (date !== todayStr) return null;
          const todayTxs = transactions.filter(t => t.date === todayStr);
          if (todayTxs.length === 0) return null;
          const catTotals: Record<string, number> = {};
          for (const t of todayTxs) {
            if (t.category) catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
          }
          const topCats = (Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([catId]) => categories.find(c => c.id === catId))
            .filter(Boolean)) as Category[];
          if (topCats.length === 0) return null;
          return (
            <div style={{ marginBottom: 14, animation: "fadeUp 0.4s 0.04s ease both", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {topCats.map((cat, idx) => {
                const chipBg = idx === 0 ? "var(--accent-dim)" : idx === 1 ? "var(--info-dim)" : "var(--warning-dim)";
                const chipFg = idx === 0 ? "var(--accent)" : idx === 1 ? "var(--info)" : "var(--warning)";
                return (
                <span key={cat.id} style={{ padding: "5px 10px", borderRadius: 999, background: chipBg, border: "1px solid transparent", fontSize: 11, color: chipFg, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{cat.icon ?? "🏷️"}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{cat.name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--danger)" }}>−{fmt(catTotals[cat.id])}</span>
                </span>
                );
              })}
            </div>
          );
        })()}

        {/* ── Amount */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 26, padding: "22px 22px 20px", marginBottom: 18, marginLeft: -8, marginRight: -8, animation: "fadeUp 0.4s 0.05s ease both", position: "relative", overflow: "hidden", transition: "background-color 0.35s ease, border-color 0.35s ease", boxShadow: "0 24px 34px color-mix(in srgb, var(--accent) 14%, transparent)" }}>
          {/* Decorative glow blob */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "var(--accent-glow)", pointerEvents: "none", transition: "background 0.4s ease" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, transition: "color 0.35s ease" }}>Amount</p>
            {displayedBalance !== null && (() => {
              const selectedAcct = accounts.find(a => a.id === accountId);
              const afterAmount = amount && parseFloat(amount) > 0 ? displayedBalance - parseFloat(amount) : null;
              const isLow = displayedBalance < 500;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedAcct && <span style={{ fontSize: 12 }}>{selectedAcct.icon}</span>}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: isLow ? "var(--danger)" : "var(--text2)", transition: "color 0.3s", letterSpacing: 0.5 }}>
                    {fmt(displayedBalance)}
                  </span>
                  {afterAmount !== null && (
                    <>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)" }}>→</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: afterAmount < 0 ? "var(--danger)" : afterAmount < 500 ? "var(--danger)" : "var(--success)", transition: "color 0.2s", letterSpacing: 0.5 }}>
                        {fmt(afterAmount)}
                      </span>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                if ((v.match(/\./g) || []).length <= 1) setAmount(v);
              }}
              onKeyDown={e => e.key === "Enter" && canSubmit && submit()}
              placeholder="0"
              autoFocus
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(52px, 16vw, 82px)",
                fontWeight: 250,
                lineHeight: 1,
                color: amount ? "var(--text)" : "var(--muted)",
                background: "transparent",
                border: "none",
                outline: "none",
                width: "100%",
                caretColor: "var(--accent)",
                letterSpacing: "-0.03em",
              }}
            />
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: "var(--muted)",
              paddingBottom: 10,
              flexShrink: 0,
              letterSpacing: 1,
              transition: "color 0.35s ease",
            }}>MAD</span>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent)", marginTop: 6, letterSpacing: 1, transition: "color 0.35s ease" }}>
              {fmt(parseFloat(amount))} MAD
            </p>
          )}
        </div>

        {/* ── Description */}
        <div style={{ marginBottom: 14, animation: "fadeUp 0.4s 0.08s ease both" }}>
          <input
            type="text"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
              const v = e.target.value.trim();
              suggestTimerRef.current = setTimeout(() => suggestCategory(v), 200);
            }}
            onKeyDown={e => e.key === "Enter" && canSubmit && submit()}
            placeholder="Description — what was it for?"
            style={inputStyle}
          />
        </div>

        {/* ── Category suggestion chip */}
        {suggestedCatId && (() => {
          const sugCat = categories.find(c => c.id === suggestedCatId);
          if (!sugCat || suggestedCatId === categoryId) return null;
          return (
            <div style={{ marginBottom: 10, animation: "fadeUp 0.2s ease both" }}>
              <button
                onClick={() => selectCategory(sugCat)}
                style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 13, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{sugCat.icon ?? "🏷️"}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{sugCat.name}</span>
              </button>
            </div>
          );
        })()}

        {/* ── Category picker */}
        <div style={{ marginBottom: 22, position: "relative", animation: "fadeUp 0.4s 0.11s ease both", zIndex: showCatPicker ? 20 : 1 }} ref={catRef}>
          <button
            onClick={() => setShowCatPicker(v => !v)}
            style={{ width: "100%", background: "var(--surface)", border: `1px solid ${showCatPicker ? "var(--accent)" : "var(--border)"}`, borderRadius: 14, padding: "13px 16px", color: selectedCat ? "var(--text)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "border-color 0.2s", textAlign: "left" }}
          >
            <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {selectedCat ? `${selectedCat.icon ?? "🏷️"} ${selectedCat.name}` : "Select category…"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {selectedCat && selectedCat.planned !== null && selectedCat.available !== null && (() => {
                const planned = selectedCat.planned!;
                const available = selectedCat.available!;
                const spent = Math.max(0, planned - available);
                const expAmt = amount && parseFloat(amount) > 0 ? parseFloat(amount) : 0;
                const spentPct = Math.min((spent / planned) * 100, 100);
                const previewPct = Math.min(((spent + expAmt) / planned) * 100, 100);
                const availableAfter = available - expAmt;
                const alreadyOver = available < 0;
                const ringColor = alreadyOver ? "var(--danger)" : spentPct > 79 ? "var(--warning)" : "var(--accent)";
                const wouldBeOver = availableAfter < 0;
                const previewStroke = wouldBeOver ? "color-mix(in srgb, var(--danger) 65%, transparent)" : "color-mix(in srgb, var(--accent) 55%, transparent)";
                const labelColor = expAmt > 0
                  ? (wouldBeOver ? "var(--danger)" : "var(--success)")
                  : (available >= 0 ? "var(--success)" : "var(--danger)");
                const labelValue = expAmt > 0 ? availableAfter : available;
                const R = 10; const C = 2 * Math.PI * R; // 62.83
                const spentDash = (spentPct / 100) * C;
                const previewDash = ((previewPct - spentPct) / 100) * C;
                return (
                  <>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, color: labelColor, transition: "color 0.2s" }}>
                      {labelValue >= 0 ? "+" : ""}{fmt(labelValue)}
                    </span>
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0, transition: "opacity 0.2s" }}>
                      {/* Track */}
                      <circle cx="14" cy="14" r={R} fill="none" stroke="var(--border2)" strokeWidth="3" />
                      {/* Spent arc */}
                      <circle cx="14" cy="14" r={R} fill="none" stroke={ringColor} strokeWidth="3"
                        strokeDasharray={`${spentDash} ${C}`} strokeLinecap="round"
                        transform="rotate(-90 14 14)" style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }} />
                      {/* Preview ghost arc */}
                      {expAmt > 0 && previewPct > spentPct && (
                        <circle cx="14" cy="14" r={R} fill="none" stroke={previewStroke} strokeWidth="3"
                          strokeDasharray={`${previewDash} ${C}`} strokeDashoffset={-spentDash} strokeLinecap="round"
                          transform="rotate(-90 14 14)" style={{ transition: "stroke-dasharray 0.15s ease" }} />
                      )}
                    </svg>
                  </>
                );
              })()}
              {/* No budget — just show available balance */}
              {selectedCat && selectedCat.available !== null && selectedCat.planned === null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, color: selectedCat.available >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {selectedCat.available >= 0 ? "+" : ""}{fmt(selectedCat.available)}
                </span>
              )}
              <span style={{ color: "var(--muted)", fontSize: 12, transform: showCatPicker ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </div>
          </button>

          {showCatPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 14, zIndex: 100, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                <input
                  type="text"
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16 }}
                />
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {filteredCats.map((cat, i) => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    style={{ width: "100%", padding: "11px 16px", background: cat.id === categoryId ? "var(--accent-dim)" : "transparent", border: "none", borderBottom: "1px solid var(--border)", color: cat.id === categoryId ? "var(--accent)" : "var(--text)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, textAlign: "left" }}
                  >
                    <span>{cat.icon ?? "🏷️"}</span>
                    <span style={{ flex: 1 }}>{cat.name}</span>
                    {cat.id === lastUsedCatId && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--accent)", letterSpacing: 1 }}>LAST</span>}
                    {cat.available !== null && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: cat.available >= 0 ? "var(--success)" : "var(--danger)", letterSpacing: 0.5 }}>
                        {cat.available >= 0 ? "+" : ""}{fmt(cat.available)}
                      </span>
                    )}
                    {cat.type[0] && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>{cat.type[0].toUpperCase()}</span>}
                  </button>
                ))}
                {filteredCats.length === 0 && (
                  <p style={{ padding: 16, color: "var(--muted)", fontSize: 13, textAlign: "center" }}>No categories found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Account */}
        <div style={{ marginBottom: 20, animation: "fadeUp 0.4s 0.14s ease both" }}>
          <p style={labelStyle}>Account</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                title={a.label}
                style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${a.id === accountId ? "var(--accent)" : "transparent"}`, background: a.id === accountId ? "var(--accent-dim)" : "var(--surface2)", color: a.id === accountId ? "var(--accent)" : "var(--text2)", fontSize: 13, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span>{a.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
            {accounts.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading accounts…</p>
            )}
          </div>
        </div>

        {/* ── Unfunded category alert */}
        {categoryUnfunded && (
          <div style={{ marginBottom: 10, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--danger) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", display: "flex", alignItems: "center", gap: 10, animation: "fadeUp 0.25s ease both" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--danger)", lineHeight: 1.4 }}>
              <strong>{selectedCat?.name}</strong> has no available budget — fund it in Notion first.
            </span>
          </div>
        )}
        {categoryOverBudget && selectedCat && (
          <div style={{ marginBottom: 10, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--danger) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", display: "flex", alignItems: "center", gap: 10, animation: "fadeUp 0.25s ease both" }}>
            <span style={{ fontSize: 16 }}>🚫</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--danger)", lineHeight: 1.4 }}>
              Over budget by <strong>{fmt(parsedAmount - (selectedCat.available ?? 0))} MAD</strong> — only <strong>{fmt(selectedCat.available ?? 0)} MAD</strong> left in <strong>{selectedCat.name}</strong>.
            </span>
          </div>
        )}

        {/* ── Submit */}
        <div style={{ position: "relative" }}>
          {showSaveBurst && (
            <>
              <span className="save-burst" style={{ ["--x" as any]: "-46px", ["--y" as any]: "-30px", ["--d" as any]: "0ms" }}>✨</span>
              <span className="save-burst" style={{ ["--x" as any]: "-12px", ["--y" as any]: "-38px", ["--d" as any]: "20ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "22px", ["--y" as any]: "-32px", ["--d" as any]: "40ms" }}>✨</span>
              <span className="save-burst" style={{ ["--x" as any]: "48px", ["--y" as any]: "-18px", ["--d" as any]: "60ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "-44px", ["--y" as any]: "16px", ["--d" as any]: "80ms" }}>✧</span>
              <span className="save-burst" style={{ ["--x" as any]: "-8px", ["--y" as any]: "22px", ["--d" as any]: "100ms" }}>✨</span>
              <span className="save-burst" style={{ ["--x" as any]: "26px", ["--y" as any]: "18px", ["--d" as any]: "120ms" }}>✧</span>
              <span className="save-burst" style={{ ["--x" as any]: "42px", ["--y" as any]: "8px", ["--d" as any]: "140ms" }}>✨</span>
            </>
          )}
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="pressable cta-save"
            style={{
              width: "100%",
              padding: "19px 18px",
              borderRadius: 20,
              border: "1.5px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              background: status === "success"
                ? "var(--success)"
                : status === "error"
                  ? "var(--danger)"
                  : (mode === "wife" ? "color-mix(in srgb, var(--accent) 82%, white)" : "var(--accent)"),
              color: mode === "wife" ? "#1f0612" : "#0d1117",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: 0.3,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit || status !== "idle" ? 1 : 0.42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              boxShadow: status === "idle" ? "0 16px 28px color-mix(in srgb, var(--accent) 32%, transparent)" : "none",
              animation: "fadeUp 0.4s 0.19s ease both",
            }}
          >
            {status === "saving" && <div style={{ width: 17, height: 17, border: "2px solid color-mix(in srgb, var(--ink-strong) 25%, transparent)", borderTopColor: "var(--ink-strong)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {status === "success" ? "✓ Saved to Notion!" : status === "error" ? `✗ ${errorMsg}` : status === "saving" ? "Saving…" : (
              <>
                <span>Save {amount ? `${fmt(parseFloat(amount))} MAD` : ""}</span>
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginLeft: 2 }}>→</span>
              </>
            )}
          </button>
        </div>

        </div>{/* ── end ADD TAB ── */}

        {/* ── PENDING TAB ── */}
        <div id="panel-pending" role="tabpanel" aria-labelledby="tab-pending" style={{ display: tab === "pending" ? "block" : "none" }}>
          <header style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent)", marginBottom: 4, fontWeight: 700 }}>Notion Finance</p>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
                  Your <em style={{ fontStyle: "italic", color: "var(--warning)" }}>wishlist</em>
                </h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={toggleMode} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 20, border: "1px solid var(--border2)", background: "var(--surface2)", cursor: "pointer", color: "var(--text2)", fontSize: 13, transition: "all 0.35s ease" }} title={`Switch to ${mode === 'wife' ? 'Husband' : 'Wife'} mode`}>
                  <span style={{ fontSize: 15 }}>{mode === "wife" ? "🎀" : "👨‍💻"}</span>
                  <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{mode === "wife" ? "Wife" : "Hubby"}</span>
                </button>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {mode === "wife" ? "💎" : "💸"}
                </div>
              </div>
            </div>
          </header>

        {/* ── Pending items ── */}
        <div style={{ animation: "fadeUp 0.4s 0.04s ease both" }}>

          {/* Quick-add row */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: pendingItems.length > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input
              type="text"
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addPending()}
              placeholder="Add item…"
              style={{ ...inputStyle, flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 12 }}
            />
            <input
              type="text"
              inputMode="decimal"
              value={pendingAmount}
              onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) || []).length <= 1) setPendingAmount(v); }}
              placeholder="Amount"
              style={{ ...inputStyle, width: 88, padding: "10px 12px", fontSize: 14, borderRadius: 12, flexShrink: 0 }}
            />
            {/* Mini category picker for pending */}
            <div style={{ position: "relative", flexShrink: 0 }} ref={pendingCatRef}>
              <button
                onClick={() => setShowPendingCatPicker(v => !v)}
                aria-label="Pick pending category"
                title="Category"
                style={{ minWidth: 44, minHeight: 44, padding: "10px 12px", borderRadius: 12, border: `1px solid ${showPendingCatPicker ? "var(--accent)" : "var(--border)"}`, background: pendingCatId ? "var(--accent-dim)" : "var(--surface)", color: pendingCatId ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontSize: 16, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {pendingCatId ? (categories.find(c => c.id === pendingCatId)?.icon ?? "🏷️") : "🏷️"}
              </button>
              {showPendingCatPicker && (
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, width: 220, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 12, zIndex: 100, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                    <input type="text" value={pendingCatSearch} onChange={e => setPendingCatSearch(e.target.value)} placeholder="Search…" autoFocus style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16 }} />
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }}>
                    <button onClick={() => { setPendingCatId(""); setShowPendingCatPicker(false); setPendingCatSearch(""); }} style={{ width: "100%", padding: "9px 12px", background: !pendingCatId ? "var(--accent-dim)" : "transparent", border: "none", borderBottom: "1px solid var(--border)", color: !pendingCatId ? "var(--accent)" : "var(--muted)", fontSize: 13, textAlign: "left", cursor: "pointer" }}>— None</button>
                    {categories.filter(c => c.name.toLowerCase().includes(pendingCatSearch.toLowerCase())).map(cat => (
                      <button key={cat.id} onClick={() => { setPendingCatId(cat.id); setShowPendingCatPicker(false); setPendingCatSearch(""); }} style={{ width: "100%", padding: "9px 12px", background: cat.id === pendingCatId ? "var(--accent-dim)" : "transparent", border: "none", borderBottom: "1px solid var(--border)", color: cat.id === pendingCatId ? "var(--accent)" : "var(--text)", fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{cat.icon ?? "🏷️"}</span><span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={addPending}
              disabled={!pendingName.trim() || addingPending}
              aria-label="Add pending item"
              style={{ minWidth: 44, minHeight: 44, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--warning)", background: "var(--warning-dim)", color: "var(--warning)", fontSize: 18, cursor: pendingName.trim() ? "pointer" : "not-allowed", opacity: pendingName.trim() ? 1 : 0.35, transition: "all 0.15s", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {addingPending ? <div style={{ width: 14, height: 14, border: "2px solid var(--warning-dim)", borderTopColor: "var(--warning)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> : "+"}
            </button>
          </div>
          <input
            type="date"
            value={pendingDate}
            onChange={e => setPendingDate(e.target.value)}
            title="Due / planned date"
            style={{ ...inputStyle, fontSize: 13, padding: "8px 12px", borderRadius: 12, color: "var(--text)", width: "100%" }}
          />
          </div>

          {/* Pending items list */}
          {pendingItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pendingItems.map((item, i) => {
                const cat = categories.find(c => c.id === item.categoryId);
                return (
                  <div
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, gap: 10, animation: `fadeUp 0.25s ${i * 0.04}s ease both` }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                      {cat?.icon ?? "🛒"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</p>
                      {(cat || item.addedBy || item.date) && (
                        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                          {[item.date ? fmtDate(item.date) : null, cat?.name, item.addedBy].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {item.amount !== null && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text2)", flexShrink: 0 }}>{fmt(item.amount)}</span>
                    )}
                    {/* Load into form */}
                    <button
                      onClick={() => loadPending(item)}
                      aria-label="Load pending item into add form"
                      title="Fill form"
                      style={{ background: "var(--accent-dim)", border: "1px solid transparent", borderRadius: 8, minWidth: 32, minHeight: 32, padding: "5px 8px", cursor: "pointer", color: "var(--accent)", fontSize: 13, flexShrink: 0, transition: "all 0.15s" }}
                    >
                      ↑
                    </button>
                    {/* Dismiss */}
                    <button
                      onClick={() => dismissPending(item.id)}
                      aria-label="Dismiss pending item"
                      title="Dismiss"
                      style={{ background: "transparent", border: "1px solid transparent", borderRadius: 8, minWidth: 32, minHeight: 32, padding: "5px 6px", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {pendingItems.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
              Nothing pending. Future-you says thanks.
            </p>
          )}
        </div>
        </div>{/* ── end PENDING TAB ── */}

        {/* ── HISTORY TAB ── */}
        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" style={{ display: tab === "history" ? "block" : "none" }}>
          <header style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent)", marginBottom: 4, fontWeight: 700 }}>Notion Finance</p>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
                  Recent <em style={{ fontStyle: "italic", color: "var(--info)" }}>expenses</em>
                </h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={toggleMode} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 20, border: "1px solid var(--border2)", background: "var(--surface2)", cursor: "pointer", color: "var(--text2)", fontSize: 13, transition: "all 0.35s ease" }} title={`Switch to ${mode === 'wife' ? 'Husband' : 'Wife'} mode`}>
                  <span style={{ fontSize: 15 }}>{mode === "wife" ? "🎀" : "👨‍💻"}</span>
                  <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{mode === "wife" ? "Wife" : "Hubby"}</span>
                </button>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {mode === "wife" ? "💎" : "💸"}
                </div>
              </div>
            </div>
          </header>

        {/* ── Recent transactions */}
        {transactions.length > 0 && (
          <div style={{ animation: "fadeUp 0.4s 0.04s ease both" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.map((t, i) => {
                const cat = categories.find(c => c.id === t.category);
                return (
                  <div
                    key={t.id}
                    onClick={() => { if (deletingId === t.id) return; setName(t.name); if (t.category) { const c = categories.find(x => x.id === t.category); if (c) selectCategory(c); } setTab("add"); }}
                    style={{ display: "flex", alignItems: "center", padding: "11px 14px", background: deletingId === t.id ? "rgba(255,107,107,0.06)" : "var(--surface)", border: `1px solid ${deletingId === t.id ? "var(--danger)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", gap: 12, transition: "border-color 0.15s, background 0.15s", animation: `fadeUp 0.3s ${i * 0.03}s ease both` }}
                    onMouseEnter={e => { if (deletingId !== t.id) { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLDivElement).style.background = "var(--surface2)"; } }}
                    onMouseLeave={e => { if (deletingId !== t.id) { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; } }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {cat?.icon ?? "🏷️"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{cat?.name ?? "—"} · {fmtDate(t.date)}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--danger)" }}>−{fmt(t.amount)}</div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteTransaction(t.id); }}
                        aria-label={deletingId === t.id ? "Confirm delete transaction" : "Delete transaction"}
                        title={deletingId === t.id ? "Tap again to confirm" : "Delete"}
                        style={{
                          background: deletingId === t.id ? "var(--danger)" : "transparent",
                          border: `1px solid ${deletingId === t.id ? "var(--danger)" : "transparent"}`,
                          borderRadius: 6,
                          minWidth: 32,
                          minHeight: 32,
                          padding: "4px 5px",
                          cursor: "pointer",
                          color: deletingId === t.id ? "var(--surface)" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>Tap a transaction to reuse it · switches to Add tab</p>
          </div>
        )}
        {transactions.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginTop: 8 }}>No transactions yet</p>
        )}
        </div>{/* ── end HISTORY TAB ── */}

      </div>

      {/* ── Bottom tab bar ── */}
      <nav
        role="tablist"
        aria-label="App navigation"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -6px 18px rgba(0,0,0,0.14)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div style={{ display: "flex", maxWidth: 480, margin: "0 auto" }}>
          {([
            { key: "add" as const, label: "Add" },
            { key: "pending" as const, label: "Pending" },
            { key: "history" as const, label: "History" },
          ]).map(t => {
            const activeColor = t.key === "add" ? "var(--accent)" : t.key === "pending" ? "var(--warning)" : "var(--info)";
            return (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "10px 0 11px", background: "none", border: "none", borderTop: `2px solid ${tab === t.key ? activeColor : "transparent"}`, cursor: "pointer", color: tab === t.key ? activeColor : "var(--muted)", transition: "color 0.2s, border-color 0.2s", position: "relative" }}
            >
              {t.key === "pending" && pendingItems.length > 0 && (
                <span style={{ position: "absolute", top: 4, right: "calc(50% - 20px)", minWidth: 16, height: 16, borderRadius: 8, background: "var(--warning)", color: "var(--ink-strong)", fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  {pendingItems.length}
                </span>
              )}
              {t.key === "add" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "add" ? "2.5" : "2"} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              )}
              {t.key === "pending" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "pending" ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              )}
              {t.key === "history" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "history" ? "2.5" : "2"} strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              )}
              <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{t.label}</span>
            </button>
          );
          })}
        </div>
      </nav>

      {microToast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
            transform: "translateX(-50%)",
            zIndex: 80,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            color: "var(--text)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: 0.4,
            boxShadow: "0 8px 24px color-mix(in srgb, var(--ink-strong) 25%, transparent)",
            animation: "toastIn 0.2s ease both",
            pointerEvents: "none",
          }}
        >
          {microToast}
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "13px 16px",
  color: "var(--text)",
  fontSize: 16,
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  appearance: "none",
  WebkitAppearance: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 12,
};
