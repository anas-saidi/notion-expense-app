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
const shiftDate = (dateStr: string, days: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};
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
  const [tab, setTab] = useState<"home" | "pending" | "history">("home");
  const [showAddModal, setShowAddModal] = useState(false);
  const [homeSearch, setHomeSearch] = useState("");

  // Form state
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
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
  const dateRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

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
    setShowAddModal(true);
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
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatPicker(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setShowAccountPicker(false);
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

  const filteredAccounts = accounts.filter(a => {
    const q = accountSearch.toLowerCase();
    return !q || a.label.toLowerCase().includes(q) || (a.type ?? "").toLowerCase().includes(q);
  });

  const homeCategories = categories
    .filter(c => {
      const q = homeSearch.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.type.some(t => t.toLowerCase().includes(q));
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
  const selectedAccount = accounts.find(a => a.id === accountId) ?? null;
  const amountAfterBalance =
    displayedBalance !== null && amount && parseFloat(amount) > 0
      ? displayedBalance - parseFloat(amount)
      : null;

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
  const totalPlanned = categories.reduce((sum, c) => sum + (c.planned ?? 0), 0);
  const totalAvailable = categories.reduce((sum, c) => sum + (c.available ?? 0), 0);

  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(var(--safe-top) + 20px) 20px calc(72px + env(safe-area-inset-bottom, 0px))" }}>

        <div id="panel-home" role="tabpanel" aria-labelledby="tab-home" style={{ display: tab === "home" ? "block" : "none" }}>
          <header style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
                  Home
                </h1>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                  All your Notion categories in one place.
                </p>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", minWidth: 124 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" }}>
                  Overview
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6, fontWeight: 700 }}>
                  {categories.length} categories
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: totalAvailable >= 0 ? "var(--success)" : "var(--danger)", marginTop: 4 }}>
                  {fmt(totalAvailable)} available
                </div>
              </div>
            </div>
          </header>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 14, animation: "fadeUp 0.35s 0.04s ease both" }}>
              <input
                type="text"
                value={homeSearch}
                onChange={e => setHomeSearch(e.target.value)}
                placeholder="Search categories"
                style={{ ...inputStyle, background: "transparent", padding: 0, border: "none", borderRadius: 0, fontSize: 16 }}
              />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {homeCategories.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => { selectCategory(cat); setShowAddModal(true); }}
                  style={{ textAlign: "left", width: "100%", padding: "14px 16px", background: "var(--surface)", border: `1px solid ${cat.id === categoryId ? "var(--accent)" : "var(--border)"}`, borderRadius: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, animation: `fadeUp 0.28s ${i * 0.03}s ease both` }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 14, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {cat.icon ?? "🏷️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cat.name}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
                      {(cat.type[0] ?? "Category").toUpperCase()} · Planned {fmt(cat.planned ?? 0)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: (cat.available ?? 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {(cat.available ?? 0) > 0 ? "+" : ""}{fmt(cat.available ?? 0)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      available
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {homeCategories.length === 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 16px", color: "var(--muted)", fontSize: 14 }}>
                No categories match that search.
              </div>
            )}
          </div>
        </div>

        {showAddModal && (
          <div role="dialog" aria-modal="true" aria-label="Add transaction" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(26, 19, 12, 0.14)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "24px 14px calc(88px + env(safe-area-inset-bottom, 0px))" }}>
            <div onClick={() => setShowAddModal(false)} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "relative", width: "min(100%, 480px)", maxHeight: "calc(100dvh - 32px)", overflow: "visible", borderRadius: 28, background: "var(--bg)", border: "1px solid color-mix(in srgb, var(--border) 82%, transparent)", boxShadow: "0 18px 38px rgba(48, 36, 23, 0.10)", padding: "18px 18px 22px", animation: "fadeUp 0.24s ease both" }}>
              <div style={{ width: 44, height: 5, borderRadius: 999, background: "color-mix(in srgb, var(--border2) 78%, transparent)", margin: "0 auto 14px" }} />
              <button onClick={() => setShowAddModal(false)} aria-label="Close add transaction" style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--border) 78%, transparent)", background: "color-mix(in srgb, var(--surface) 90%, white)", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                ×
              </button>
              <div id="panel-add" style={{ maxHeight: "calc(100dvh - 88px)", overflowY: "auto", paddingRight: 2 }}>
                {/* Modal Header */}
                <header style={{ marginBottom: 16, paddingRight: 52, animation: "fadeUp 0.4s ease both" }}>
                  <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, lineHeight: 1, color: "var(--text)", letterSpacing: -0.25 }}>
                    Add Transaction
                  </h1>
                </header>

        <div style={{ background: "color-mix(in srgb, var(--surface) 97%, white)", border: "1px solid color-mix(in srgb, var(--border2) 56%, transparent)", borderRadius: 24, padding: "16px 18px 13px", marginBottom: 10, animation: "fadeUp 0.4s 0.05s ease both", position: "relative", zIndex: showAccountPicker ? 12 : 1, overflow: "visible", transition: "background-color 0.35s ease, border-color 0.35s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, transition: "color 0.35s ease" }}>Amount</p>
            <div style={{ position: "relative", zIndex: showAccountPicker ? 20 : 2 }} ref={accountRef}>
              <button
                onClick={() => { setShowAccountPicker(v => !v); setShowDatePicker(false); setShowCatPicker(false); }}
                style={{ minHeight: 34, maxWidth: 172, padding: "0 10px", borderRadius: 999, border: `1px solid ${showAccountPicker ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "color-mix(in srgb, var(--border2) 48%, transparent)"}`, background: "color-mix(in srgb, var(--surface) 86%, white)", color: accountId ? "var(--text)" : "var(--text2)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.92 }}>{selectedAccount?.icon ?? "🏦"}</span>
                <span style={{ fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedAccount?.label ?? "Account"}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 9 }}>▾</span>
              </button>
              {showAccountPicker && (
                <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: "min(296px, calc(100vw - 72px))", maxWidth: "calc(100vw - 72px)", background: "color-mix(in srgb, var(--surface) 99%, white)", border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 20px rgba(47,36,25,0.09)", zIndex: 120 }}>
                  <div style={{ maxHeight: 248, overflowY: "auto", padding: 8 }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      {filteredAccounts.map(acct => (
                        <button
                          key={acct.id}
                          onClick={() => { setAccountId(acct.id); setShowAccountPicker(false); setAccountSearch(""); }}
                          style={{ width: "100%", minHeight: 46, padding: "10px 12px", background: "transparent", border: "none", borderRadius: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, textAlign: "left" }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 11, background: "color-mix(in srgb, var(--surface2) 72%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>
                            {acct.icon ?? "•"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: acct.id === accountId ? 600 : 550, color: acct.id === accountId ? "var(--accent)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</div>
                            {acct.type && <div style={{ marginTop: 2, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.type.toUpperCase()}</div>}
                          </div>
                          {acct.balance !== null && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: acct.balance >= 0 ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                              {fmt(acct.balance)}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredAccounts.length === 0 && (
                        <p style={{ padding: 18, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>No accounts found</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--muted)", paddingBottom: 10, flexShrink: 0, letterSpacing: 1, transition: "color 0.35s ease" }}>MAD</span>
          </div>
          {(displayedBalance !== null || amountAfterBalance !== null) && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {displayedBalance !== null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: displayedBalance < 500 ? "var(--danger)" : "var(--muted)", letterSpacing: 0.4 }}>
                  Balance {fmt(displayedBalance)}
                </span>
              )}
              {amountAfterBalance !== null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: amountAfterBalance < 0 ? "var(--danger)" : amountAfterBalance < 500 ? "var(--danger)" : "var(--success)", letterSpacing: 0.4 }}>
                  After {fmt(amountAfterBalance)}
                </span>
              )}
            </div>
          )}
        </div>


        <div style={{ marginBottom: 12, marginTop: 0, animation: "fadeUp 0.4s 0.08s ease both" }}>
          <div style={{ background: "color-mix(in srgb, var(--surface) 96%, white)", border: "1px solid color-mix(in srgb, var(--border) 64%, transparent)", borderRadius: 22, padding: "15px 16px 13px" }}>
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
              placeholder="What was it for?"
              style={{ ...inputStyle, background: "transparent", border: "none", padding: 0, borderRadius: 0, fontSize: 20, color: "var(--text)" }}
            />

            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative" }} ref={catRef}>
                <button
                  onClick={() => { setShowCatPicker(v => !v); setShowDatePicker(false); setShowAccountPicker(false); }}
                  style={{ minHeight: 26, padding: "0 7px", borderRadius: 999, border: `1px solid ${showCatPicker ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--border) 22%, transparent)"}`, background: "transparent", color: selectedCat ? "var(--text2)" : "var(--muted)", fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.92 }}>{selectedCat?.icon ?? "🏷️"}</span>
                  <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                    {selectedCat?.name ?? "Category"}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 9 }}>▾</span>
                </button>
                {showCatPicker && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 12px)", left: 0, width: "min(318px, calc(100vw - 72px))", maxWidth: "calc(100vw - 72px)", background: "color-mix(in srgb, var(--surface) 99%, white)", border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 20px rgba(47,36,25,0.09)", zIndex: 80 }}>
                    <div style={{ maxHeight: 216, overflowY: "auto", padding: 8 }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        {filteredCats.map(cat => {
                          const meta = [cat.type[0] ?? null, cat.id === lastUsedCatId ? "Last used" : null].filter(Boolean).join(" · ");
                          return (
                            <button
                              key={cat.id}
                              onClick={() => selectCategory(cat)}
                              style={{ width: "100%", minHeight: 46, padding: "10px 12px", background: "transparent", border: "none", borderRadius: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, textAlign: "left" }}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 11, background: "color-mix(in srgb, var(--surface2) 72%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>
                                {cat.icon ?? "•"}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                                {meta && <div style={{ marginTop: 2, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>}
                              </div>
                              {cat.available !== null && (
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: cat.available >= 0 ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                                  {cat.available >= 0 ? "+" : ""}{fmt(cat.available)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {filteredCats.length === 0 && (
                          <p style={{ padding: 18, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>No categories found</p>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface2) 14%, transparent)" }}>
                      <input
                        type="text"
                        value={catSearch}
                        onChange={e => setCatSearch(e.target.value)}
                        placeholder="Search categories"
                        autoFocus
                        style={{ ...inputStyle, background: "transparent", border: "none", padding: 0, borderRadius: 0, fontSize: 16 }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ position: "relative" }} ref={dateRef}>
              <button
                onClick={() => { setShowDatePicker(v => !v); setShowCatPicker(false); setShowAccountPicker(false); }}
                style={{ minHeight: 28, padding: 0, border: "none", background: "transparent", color: date === today() ? "var(--muted)" : "color-mix(in srgb, var(--accent) 80%, var(--text2))", fontSize: 11.5, fontWeight: date === today() ? 450 : 550, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: date === today() ? 0.82 : 1 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
                <span>{selectedDateLabel}</span>
              </button>
              {showDatePicker && (
                <div style={{ position: "absolute", bottom: "calc(100% + 12px)", left: 0, width: "min(220px, calc(100vw - 72px))", maxWidth: "calc(100vw - 72px)", background: "color-mix(in srgb, var(--surface) 99%, white)", border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 20px rgba(47,36,25,0.09)", zIndex: 80 }}>
                  <div style={{ display: "grid", gap: 2, padding: 8 }}>
                    {[
                      { label: "Today", value: today() },
                      { label: "Yesterday", value: shiftDate(today(), -1) },
                      { label: "Tomorrow", value: shiftDate(today(), 1) },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => { setDate(option.value); setShowDatePicker(false); }}
                        style={{ width: "100%", minHeight: 44, padding: "10px 12px", background: option.value === date ? "color-mix(in srgb, var(--accent) 14%, white)" : "transparent", border: "none", borderRadius: 12, color: option.value === date ? "var(--accent)" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", fontSize: 14, textAlign: "left" }}
                      >
                        <span style={{ fontWeight: option.value === date ? 700 : 550 }}>{option.label}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: option.value === date ? "color-mix(in srgb, var(--accent) 78%, var(--text2))" : "var(--muted)" }}>{fmtDate(option.value)}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: "10px 12px", borderTop: "1px solid color-mix(in srgb, var(--accent) 14%, var(--border))", background: "color-mix(in srgb, var(--accent) 5%, var(--surface2))" }}>
                    <input
                      type="date"
                      value={date}
                      onChange={e => { setDate(e.target.value); setShowDatePicker(false); }}
                      style={{ ...inputStyle, background: "transparent", border: "none", padding: 0, borderRadius: 0, colorScheme: "light", fontSize: 16, color: "var(--text)" }}
                    />
                  </div>
                </div>
              )}
              </div>
              </div>
            {(suggestedCatId || categoryUnfunded || categoryOverBudget) && (
              <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                {suggestedCatId && (() => {
                  const sugCat = categories.find(c => c.id === suggestedCatId);
                  if (!sugCat || suggestedCatId === categoryId) return null;
                  return (
                    <button
                      onClick={() => selectCategory(sugCat)}
                      style={{ minHeight: 32, padding: "0 2px", border: "none", background: "transparent", color: "var(--text2)", fontSize: 12.5, cursor: "pointer", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 8, justifySelf: "start" }}
                    >
                      <span style={{ fontSize: 14, opacity: 0.85 }}>{sugCat.icon ?? "🏷️"}</span>
                      <span>Try <strong style={{ fontWeight: 600 }}>{sugCat.name}</strong></span>
                    </button>
                  );
                })()}

                {categoryUnfunded && (
                  <div style={{ padding: "0 2px", display: "flex", alignItems: "flex-start", gap: 7, animation: "fadeUp 0.25s ease both" }}>
                    <span style={{ fontSize: 12, opacity: 0.62, marginTop: 2 }}>⚠</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "color-mix(in srgb, var(--danger) 54%, var(--text2))", lineHeight: 1.45 }}>
                      <strong>{selectedCat?.name}</strong> has no available budget — fund it in Notion first.
                    </span>
                  </div>
                )}
                {categoryOverBudget && selectedCat && (
                  <div style={{ padding: "0 2px", display: "flex", alignItems: "flex-start", gap: 7, animation: "fadeUp 0.25s ease both" }}>
                    <span style={{ fontSize: 12, opacity: 0.62, marginTop: 2 }}>⚠</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "color-mix(in srgb, var(--danger) 54%, var(--text2))", lineHeight: 1.45 }}>
                      Over budget by <strong>{fmt(parsedAmount - (selectedCat.available ?? 0))} MAD</strong> — only <strong>{fmt(selectedCat.available ?? 0)} MAD</strong> left in <strong>{selectedCat.name}</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Submit */}
        <div style={{ position: "relative" }}>
          {showSaveBurst && (
            <>
              <span className="save-burst" style={{ ["--x" as any]: "-46px", ["--y" as any]: "-30px", ["--d" as any]: "0ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "-12px", ["--y" as any]: "-38px", ["--d" as any]: "20ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "22px", ["--y" as any]: "-32px", ["--d" as any]: "40ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "48px", ["--y" as any]: "-18px", ["--d" as any]: "60ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "-44px", ["--y" as any]: "16px", ["--d" as any]: "80ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "-8px", ["--y" as any]: "22px", ["--d" as any]: "100ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "26px", ["--y" as any]: "18px", ["--d" as any]: "120ms" }}>✦</span>
              <span className="save-burst" style={{ ["--x" as any]: "42px", ["--y" as any]: "8px", ["--d" as any]: "140ms" }}>✦</span>
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
              boxShadow: status === "idle" ? "0 10px 18px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
              animation: "fadeUp 0.4s 0.19s ease both",
            }}
          >
            {status === "saving" && <div style={{ width: 17, height: 17, border: "2px solid color-mix(in srgb, var(--ink-strong) 25%, transparent)", borderTopColor: "var(--ink-strong)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {status === "success" ? "✓ Saved to Notion!" : status === "error" ? `✗ ${errorMsg}` : status === "saving" ? "Saving…" : (
              <>
                <span>Save {amount ? `${fmt(parseFloat(amount))} MAD` : "expense"}</span>
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginLeft: 2 }}>→</span>
              </>
            )}
          </button>
        </div>

              </div>
            </div>
          </div>
        )}

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
                    onClick={() => { if (deletingId === t.id) return; setName(t.name); if (t.category) { const c = categories.find(x => x.id === t.category); if (c) selectCategory(c); } setShowAddModal(true); }}
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
            <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>Tap a transaction to reuse it · opens the Add modal</p>
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
            { key: "home" as const, label: "Home" },
            { key: "pending" as const, label: "Pending" },
            { key: "history" as const, label: "History" },
          ]).map(t => {
            const activeColor = t.key === "home" ? "var(--accent)" : t.key === "pending" ? "var(--warning)" : "var(--info)";
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
              {t.key === "home" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "home" ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
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

      <button
        onClick={() => setShowAddModal(true)}
        aria-label="Open add expense"
        style={{ position: "fixed", right: "max(18px, calc(50% - 222px))", bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", zIndex: 60, width: 58, height: 58, borderRadius: "50%", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", background: mode === "wife" ? "color-mix(in srgb, var(--accent) 82%, white)" : "var(--accent)", color: mode === "wife" ? "#1f0612" : "#0d1117", boxShadow: "0 18px 28px color-mix(in srgb, var(--accent) 30%, transparent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

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

