"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string; icon: string | null; type: string[]; defaultAccount: string | null; available: number | null; planned: number | null };
type Transaction = { id: string; name: string; amount: number; date: string; category: string | null };
type Account = { id: string; label: string; icon: string; type: string | null };

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
  const catRef = useRef<HTMLDivElement>(null);

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

  // Close cat picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatPicker(false);
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
      // Prepend to local transactions list
      setTransactions(prev => [{
        id: data.id,
        name,
        amount: parseFloat(amount),
        date,
        category: categoryId,
      }, ...prev.slice(0, 9)]);

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

  const canSubmit = amount && parseFloat(amount) > 0 && name.trim() && categoryId && status === "idle";

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

        {/* ── Today's summary */}
        {(() => {
          const todayStr = today();
          const todayTxs = transactions.filter(t => t.date === todayStr);
          const todayTotal = todayTxs.reduce((s, t) => s + t.amount, 0);
          if (todayTxs.length === 0) return null;
          return (
            <div style={{ marginBottom: 14, animation: "fadeUp 0.4s 0.03s ease both", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)" }}>Today</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text2)" }}>{todayTxs.length} expense{todayTxs.length !== 1 ? "s" : ""}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--danger)", fontWeight: 500 }}>−{fmt(todayTotal)} MAD</span>
              </div>
            </div>
          );
        })()}

        {/* ── Amount */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 20px 18px", marginBottom: 14, animation: "fadeUp 0.4s 0.05s ease both", position: "relative", overflow: "hidden", transition: "background-color 0.35s ease, border-color 0.35s ease" }}>
          {/* Decorative glow blob */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--accent-glow), transparent 70%)", pointerEvents: "none", transition: "background 0.4s ease" }} />
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 12, transition: "color 0.35s ease" }}>Amount</p>
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

        {/* ── Date */}
        <div style={{ marginBottom: 16, animation: "fadeUp 0.4s 0.16s ease both" }}>
          <p style={labelStyle}>Date</p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark", fontSize: 13, width: "auto", minWidth: 160 }}
          />
        </div>

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
                    onClick={() => { setName(t.name); if (t.category) { const c = categories.find(x => x.id === t.category); if (c) selectCategory(c); } }}
                    style={{ display: "flex", alignItems: "center", padding: "11px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", gap: 12, transition: "border-color 0.15s, background 0.15s", animation: `fadeUp 0.3s ${i * 0.03}s ease both` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLDivElement).style.background = "var(--surface2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {cat?.icon ?? "🏷️"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{cat?.name ?? "—"} · {fmtDate(t.date)}</p>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--danger)", flexShrink: 0 }}>−{fmt(t.amount)}</div>
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
