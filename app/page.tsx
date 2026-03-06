"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string; icon: string | null; type: string[]; defaultAccount: string | null; available: number | null; planned: number | null };
type Transaction = { id: string; name: string; amount: number; date: string; category: string | null };
type Account = { id: string; label: string; icon: string; type: string | null; balance: number | null };
type PendingItem = { id: string; name: string; amount: number | null; categoryId: string | null; addedBy: string | null };

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

  // Form state
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [lastUsedCatId, setLastUsedCatId] = useState<string>("");
  const [refreshingTx, setRefreshingTx] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const balanceAnimRef = useRef<number | null>(null);
  const catRef = useRef<HTMLDivElement>(null);

  // Pending purchases state
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingName, setPendingName] = useState("");
  const [pendingAmount, setPendingAmount] = useState("");
  const [pendingCatId, setPendingCatId] = useState("");
  const [addingPending, setAddingPending] = useState(false);
  const [showPendingCatPicker, setShowPendingCatPicker] = useState(false);
  const [pendingCatSearch, setPendingCatSearch] = useState("");
  const [refreshingPending, setRefreshingPending] = useState(false);
  const pendingCatRef = useRef<HTMLDivElement>(null);
  const loadedPendingId = useRef<string | null>(null);

  // Sync mode to <html> so CSS vars apply to body, body::before, etc.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

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

    // Restore last used category from localStorage
    const saved = localStorage.getItem("lastCatId");
    if (saved) setLastUsedCatId(saved);
  }, []);

  // Set last used category as default when loaded
  useEffect(() => {
    if (lastUsedCatId && categories.find(c => c.id === lastUsedCatId)) {
      setCategoryId(lastUsedCatId);
    }
  }, [lastUsedCatId, categories]);

  const fetchTransactions = async () => {
    setRefreshingTx(true);
    try {
      const data = await fetch("/api/transactions").then(r => r.json());
      setTransactions(data.transactions ?? []);
    } finally {
      setRefreshingTx(false);
    }
  };

  const fetchPending = async () => {
    setRefreshingPending(true);
    try {
      const data = await fetch("/api/pending").then(r => r.json());
      setPendingItems(data.items ?? []);
    } catch {
      // silently keep existing items if fetch fails
    } finally {
      setRefreshingPending(false);
    }
  };

  const addPending = async () => {
    if (!pendingName.trim()) return;
    setAddingPending(true);
    const optimistic: PendingItem = { id: `tmp-${Date.now()}`, name: pendingName.trim(), amount: pendingAmount ? parseFloat(pendingAmount) : null, categoryId: pendingCatId || null, addedBy: mode === "wife" ? "Wife" : "Husband" };
    setPendingItems(prev => [...prev, optimistic]);
    setPendingName(""); setPendingAmount(""); setPendingCatId("");
    try {
      const data = await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: optimistic.name, amount: optimistic.amount, categoryId: optimistic.categoryId, addedBy: optimistic.addedBy }),
      }).then(r => r.json());
      // Replace optimistic with real id
      setPendingItems(prev => prev.map(p => p.id === optimistic.id ? { ...p, id: data.id } : p));
    } catch {
      setPendingItems(prev => prev.filter(p => p.id !== optimistic.id));
    } finally {
      setAddingPending(false);
    }
  };

  const loadPending = (item: PendingItem) => {
    setName(item.name);
    if (item.amount !== null) setAmount(String(item.amount));
    if (item.categoryId) {
      const cat = categories.find(c => c.id === item.categoryId);
      if (cat) selectCategory(cat);
    }
    loadedPendingId.current = item.id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dismissPending = async (id: string) => {
    setPendingItems(prev => prev.filter(p => p.id !== id));
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
    localStorage.setItem("lastCatId", cat.id);
    if (cat.defaultAccount) {
      const acct = accounts.find(a => a.id === cat.defaultAccount);
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
      setDate(today());
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  // ── Loading
  if (loading) return (
    <div data-mode={mode} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: 28, height: 28, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  const categoryUnfunded = !!(selectedCat && selectedCat.available !== null && selectedCat.available === 0);
  const canSubmit = amount && parseFloat(amount) > 0 && name.trim() && categoryId && status === "idle" && !categoryUnfunded;

  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(var(--safe-top) + 20px) 20px calc(var(--safe-bottom) + 32px)" }}>

        {/* ── Header */}
        <header style={{ marginBottom: 28, animation: "fadeUp 0.4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent)", marginBottom: 4, transition: "color 0.35s ease" }}>
                Notion Finance
              </p>
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
                Add <em style={{ fontStyle: "italic", color: "var(--accent)", transition: "color 0.35s ease" }}>expense</em>
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
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
            <div style={{ marginBottom: 14, animation: "fadeUp 0.4s 0.03s ease both", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, gap: 12 }}>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16, fontFamily: "'DM Mono', monospace", colorScheme: "dark", cursor: "pointer", padding: 0, flexShrink: 0, letterSpacing: 0.5 }}
              />
              {isToday && todayTxs.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)" }}>{todayTxs.length} expense{todayTxs.length !== 1 ? "s" : ""}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>−{fmt(todayTotal)} MAD</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Amount */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 20px 18px", marginBottom: 14, animation: "fadeUp 0.4s 0.05s ease both", position: "relative", overflow: "hidden", transition: "background-color 0.35s ease, border-color 0.35s ease" }}>
          {/* Decorative glow blob */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--accent-glow), transparent 70%)", pointerEvents: "none", transition: "background 0.4s ease" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", transition: "color 0.35s ease" }}>Amount</p>
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
                fontSize: "clamp(42px, 14vw, 68px)",
                fontWeight: 300,
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
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && canSubmit && submit()}
            placeholder="Description — what was it for?"
            style={inputStyle}
          />
        </div>

        {/* ── Category picker */}
        <div style={{ marginBottom: 14, position: "relative", animation: "fadeUp 0.4s 0.11s ease both", zIndex: showCatPicker ? 20 : 1 }} ref={catRef}>
          <button
            onClick={() => setShowCatPicker(v => !v)}
            style={{ width: "100%", background: "var(--surface)", border: `1px solid ${showCatPicker ? "var(--accent)" : "var(--border)"}`, borderRadius: 14, padding: "13px 16px", color: selectedCat ? "var(--text)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "border-color 0.2s", textAlign: "left" }}
          >
            <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {selectedCat ? `${selectedCat.icon ?? "🏷️"} ${selectedCat.name}` : "Select category…"}
              {selectedCat && selectedCat.available !== null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: selectedCat.available >= 0 ? "var(--success)" : "var(--danger)", letterSpacing: 0.5, flexShrink: 0 }}>
                  {selectedCat.available >= 0 ? "+" : ""}{fmt(selectedCat.available)}
                </span>
              )}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 12, transform: showCatPicker ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
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

        {/* ── Budget bar (shown when category has a plan) */}
        {selectedCat && selectedCat.planned !== null && selectedCat.available !== null && (() => {
          const planned = selectedCat.planned!;
          const available = selectedCat.available!;
          const spent = Math.max(0, planned - available);
          const expAmt = amount && parseFloat(amount) > 0 ? parseFloat(amount) : 0;
          const spentPct = Math.min((spent / planned) * 100, 100);
          const previewPct = Math.min(((spent + expAmt) / planned) * 100, 100);
          const availableAfter = available - expAmt;
          // Bar color reflects current state only (not what user is typing)
          const alreadyOver = available < 0;
          const barColor = alreadyOver ? "var(--danger)" : spentPct > 79 ? "#f59e0b" : "var(--accent)";
          // Ghost preview turns red only if typing this expense would exceed budget
          const wouldBeOver = availableAfter < 0;
          const previewColor = wouldBeOver ? "rgba(255,107,107,0.4)" : "rgba(200,245,90,0.3)";
          // Label: available remaining — green/accent if positive, red if over
          const labelColor = expAmt > 0
            ? (wouldBeOver ? "var(--danger)" : "var(--success)")
            : (available >= 0 ? "var(--success)" : "var(--danger)");
          const labelValue = expAmt > 0 ? availableAfter : available;
          return (
            <div style={{ marginBottom: 14, animation: "budgetBarIn 0.25s ease both", transformOrigin: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)" }}>
                  {selectedCat.icon} {selectedCat.name}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: labelColor, letterSpacing: 0.5, transition: "color 0.2s" }}>
                  {labelValue >= 0 ? "+" : ""}{fmt(labelValue)}{" "}
                  <span style={{ color: "var(--muted)" }}>left of {fmt(planned)}</span>
                </span>
              </div>
              {/* Track: fills left→right showing consumed */}
              <div style={{ height: 5, borderRadius: 99, background: "var(--surface2)", overflow: "hidden", position: "relative" }}>
                {/* Spent fill — reflects current reality, color based on current state only */}
                <div style={{
                  position: "absolute", left: 0, top: 0, height: "100%",
                  width: `${spentPct}%`,
                  background: barColor,
                  borderRadius: 99,
                  transition: "width 0.3s ease, background 0.3s ease",
                }} />
                {/* Preview ghost — shows impact of current typed amount */}
                {expAmt > 0 && previewPct > spentPct && (
                  <div style={{
                    position: "absolute", left: `${spentPct}%`, top: 0, height: "100%",
                    width: `${previewPct - spentPct}%`,
                    background: previewColor,
                    borderRadius: "0 99px 99px 0",
                    transition: "width 0.15s ease, background 0.2s ease",
                  }} />
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Account */}
        <div style={{ marginBottom: 10, animation: "fadeUp 0.4s 0.14s ease both" }}>
          <p style={labelStyle}>Account</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                title={a.label}
                style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${a.id === accountId ? "var(--accent)" : "var(--border)"}`, background: a.id === accountId ? "var(--accent-dim)" : "var(--surface)", color: a.id === accountId ? "var(--accent)" : "var(--text2)", fontSize: 13, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span>{a.icon}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{a.label}</span>
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

        {/* ── Submit */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: 17,
            borderRadius: 16,
            border: "none",
            background: status === "success" ? "var(--success)" : status === "error" ? "var(--danger)" : "var(--accent)",
            color: "#080810",
            fontWeight: 600,
            fontSize: 16,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit || status !== "idle" ? 1 : 0.35,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
            animation: "fadeUp 0.4s 0.19s ease both",
            transform: "translateY(0)",
          }}
        >
          {status === "saving" && <div style={{ width: 17, height: 17, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#080810", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
          {status === "success" ? "✓ Saved to Notion!" : status === "error" ? `✗ ${errorMsg}` : status === "saving" ? "Saving…" : `Save ${amount ? `${fmt(parseFloat(amount))} MAD` : ""} →`}
        </button>

        {/* ── Pending purchases */}
        <div style={{ marginTop: 36, animation: "fadeUp 0.4s 0.21s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)" }}>Pending</p>
            <button
              onClick={fetchPending}
              disabled={refreshingPending}
              title="Refresh"
              style={{ background: "none", border: "none", cursor: refreshingPending ? "default" : "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center", opacity: refreshingPending ? 0.5 : 1, transition: "opacity 0.2s, color 0.2s" }}
              onMouseEnter={e => { if (!refreshingPending) (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshingPending ? "spin 0.7s linear infinite" : "none" }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* Quick-add row */}
          <div style={{ display: "flex", gap: 8, marginBottom: pendingItems.length > 0 ? 10 : 0, alignItems: "stretch" }}>
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
                title="Category"
                style={{ height: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${showPendingCatPicker ? "var(--accent)" : "var(--border)"}`, background: pendingCatId ? "var(--accent-dim)" : "var(--surface)", color: pendingCatId ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontSize: 16, transition: "all 0.15s", display: "flex", alignItems: "center" }}
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
              style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 18, cursor: pendingName.trim() ? "pointer" : "not-allowed", opacity: pendingName.trim() ? 1 : 0.35, transition: "all 0.15s", flexShrink: 0, display: "flex", alignItems: "center" }}
            >
              {addingPending ? <div style={{ width: 14, height: 14, border: "2px solid var(--accent-dim)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> : "+"}
            </button>
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
                      {(cat || item.addedBy) && (
                        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                          {[cat?.name, item.addedBy].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {item.amount !== null && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text2)", flexShrink: 0 }}>{fmt(item.amount)}</span>
                    )}
                    {/* Load into form */}
                    <button
                      onClick={() => loadPending(item)}
                      title="Fill form"
                      style={{ background: "var(--accent-dim)", border: "1px solid transparent", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--accent)", fontSize: 13, flexShrink: 0, transition: "all 0.15s" }}
                    >
                      ↑
                    </button>
                    {/* Dismiss */}
                    <button
                      onClick={() => dismissPending(item.id)}
                      title="Dismiss"
                      style={{ background: "transparent", border: "1px solid transparent", borderRadius: 8, padding: "5px 6px", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", flexShrink: 0, transition: "all 0.15s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {pendingItems.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>Nothing pending — add items above</p>
          )}
        </div>

        {/* ── Recent transactions */}
        {transactions.length > 0 && (
          <div style={{ marginTop: 36, animation: "fadeUp 0.4s 0.2s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)" }}>Recent</p>
              <button
                onClick={fetchTransactions}
                disabled={refreshingTx}
                title="Refresh"
                style={{
                  background: "none",
                  border: "none",
                  cursor: refreshingTx ? "default" : "pointer",
                  color: "var(--muted)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  opacity: refreshingTx ? 0.5 : 1,
                  transition: "opacity 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { if (!refreshingTx) (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: refreshingTx ? "spin 0.7s linear infinite" : "none" }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.map((t, i) => {
                const cat = categories.find(c => c.id === t.category);
                return (
                  <div
                    key={t.id}
                    onClick={() => { if (deletingId === t.id) return; setName(t.name); if (t.category) { const c = categories.find(x => x.id === t.category); if (c) selectCategory(c); } }}
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
                        title={deletingId === t.id ? "Tap again to confirm" : "Delete"}
                        style={{
                          background: deletingId === t.id ? "var(--danger)" : "transparent",
                          border: `1px solid ${deletingId === t.id ? "var(--danger)" : "transparent"}`,
                          borderRadius: 6,
                          padding: "4px 5px",
                          cursor: "pointer",
                          color: deletingId === t.id ? "#fff" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
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
            <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>Tap a transaction to reuse it</p>
          </div>
        )}
      </div>
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
  transition: "border-color 0.2s",
  appearance: "none",
  WebkitAppearance: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 9,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 8,
};
