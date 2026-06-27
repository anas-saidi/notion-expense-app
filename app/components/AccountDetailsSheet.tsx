"use client";

import { useState, useMemo, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Money } from "./Money";
import type { Account, Category, Transaction } from "./app-types";
import { fmt, fmtDate } from "./app-utils";
import {
  BanknoteIcon,
  TransferIcon,
  ScaleIcon,
  XIcon,
  CheckIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from "./ui/icons";

type AccountDetailsSheetProps = {
  open: boolean;
  account: Account | null;
  transactions: Transaction[];
  categories: Category[];
  onClose: () => void;
  onMove: (account: Account) => void;
  onIncome: (account: Account) => void;
  onReconcileSuccess: (message: string) => void;
};

type ReconcileStatus = "idle" | "saving" | "success" | "error";

export function AccountDetailsSheet({
  open,
  account,
  transactions,
  categories,
  onClose,
  onMove,
  onIncome,
  onReconcileSuccess,
}: AccountDetailsSheetProps) {
  const [showReconcile, setShowReconcile] = useState(false);
  const [actualBalance, setActualBalance] = useState("");
  const [reconcileStatus, setReconcileStatus] = useState<ReconcileStatus>("idle");
  const [reconcileError, setReconcileError] = useState("");

  const handleClose = () => {
    setShowReconcile(false);
    setActualBalance("");
    setReconcileStatus("idle");
    setReconcileError("");
    onClose();
  };

  // Transactions from this account
  const accountTxns = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter(t => t.accountId === account.id)
      .slice(0, 20);
  }, [account, transactions]);

  // Category spend breakdown for this account (current loaded transactions)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of accountTxns) {
      if (!t.category || (t.type && t.type !== "Expense")) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([catId, total]) => ({ cat: categories.find(c => c.id === catId) ?? null, total }))
      .filter(({ cat }) => cat !== null)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [accountTxns, categories]);

  const maxCatSpend = catBreakdown[0]?.total ?? 1;

  // Totals from loaded transactions
  const totalSpentFromAcct = useMemo(
    () => accountTxns
      .filter(t => !t.type || t.type === "Expense")
      .reduce((s, t) => s + t.amount, 0),
    [accountTxns],
  );
  const totalIncomeToAcct = useMemo(
    () => accountTxns
      .filter(t => t.type === "Income")
      .reduce((s, t) => s + t.amount, 0),
    [accountTxns],
  );

  // Reconcile
  const parsedActual = parseFloat(actualBalance.replace(/[^0-9.\-]/g, ""));
  const currentBalance = account?.balance ?? 0;
  const difference = Number.isFinite(parsedActual) ? parsedActual - currentBalance : null;

  const submitReconcile = async () => {
    if (!account || !Number.isFinite(parsedActual)) return;
    setReconcileStatus("saving");
    setReconcileError("");
    try {
      const res = await fetch("/api/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          actualBalance: parsedActual,
          currentBalance,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reconcile");
      setReconcileStatus("success");
      onReconcileSuccess(`${account.label} reconciled`);
      setTimeout(() => {
        setShowReconcile(false);
        setActualBalance("");
        setReconcileStatus("idle");
      }, 1800);
    } catch (e: unknown) {
      setReconcileStatus("error");
      setReconcileError(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!account) return null;

  const isNegative = (account.balance ?? 0) < 0;

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      label={`${account.label} details`}
      detent="content"
      maxWidth="520px"
      snapPoints={[0, 0.88]}
      initialSnap={1}
      maxHeight="calc(100dvh - 20px)"
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={innerStyle}>

        {/* Header */}
        <header style={headerStyle}>
          <div style={acctIdentityStyle}>
            <div style={iconCircleStyle}>{account.icon}</div>
            <div>
              <p style={acctNameStyle}>{account.label}</p>
              {account.type && <p style={acctTypeStyle}>{account.type}</p>}
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close" style={closeStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* Balance hero */}
        <div style={heroStyle}>
          <p style={heroLabelStyle}>Current balance</p>
          <p style={{ ...heroValueStyle, color: isNegative ? "var(--danger)" : "var(--text)" }}>
            <Money value={account.balance ?? 0} absolute={isNegative} />
          </p>
          {account.readyToAssign != null && (
            <p style={heroSubStyle}>
              {fmt(account.readyToAssign)} MAD ready to assign
            </p>
          )}
        </div>

        {/* Stat pills */}
        {(totalSpentFromAcct > 0 || totalIncomeToAcct > 0) && (
          <div style={statsRowStyle}>
            {totalSpentFromAcct > 0 && (
              <div style={statPillStyle}>
                <span style={statLabelStyle}>Spent</span>
                <strong style={statValueStyle}><Money value={totalSpentFromAcct} /></strong>
              </div>
            )}
            {totalIncomeToAcct > 0 && (
              <div style={statPillStyle}>
                <span style={statLabelStyle}>Income</span>
                <strong style={{ ...statValueStyle, color: "var(--accent-ink)" }}><Money value={totalIncomeToAcct} /></strong>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={actionsRowStyle}>
          <ActionBtn
            icon={<TransferIcon size={16} strokeWidth={2.2} />}
            label="Move"
            onClick={() => { handleClose(); onMove(account); }}
          />
          <ActionBtn
            icon={<BanknoteIcon size={16} strokeWidth={2.2} />}
            label="Income"
            onClick={() => { handleClose(); onIncome(account); }}
          />
          <ActionBtn
            icon={<ScaleIcon size={16} strokeWidth={2.2} />}
            label="Reconcile"
            active={showReconcile}
            onClick={() => setShowReconcile(v => !v)}
          />
        </div>

        {/* Reconcile form */}
        {showReconcile && (
          <div style={reconcilePanelStyle}>
            <p style={reconcileTitleStyle}>Reconcile balance</p>
            <p style={reconcileHintStyle}>
              Enter the real balance from your bank or statement.
            </p>
            <div style={reconcileRowStyle}>
              <label style={reconcileFieldStyle}>
                <span style={reconcileLabelStyle}>App balance</span>
                <div style={reconcileReadonlyStyle}>
                  <Money value={currentBalance} />
                </div>
              </label>
              <label style={reconcileFieldStyle}>
                <span style={reconcileLabelStyle}>Actual balance</span>
                <div style={reconcileInputWrapStyle}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={actualBalance}
                    onChange={e => setActualBalance(e.target.value)}
                    placeholder="0"
                    style={reconcileInputStyle}
                    autoFocus
                  />
                  <span style={reconcileCurrencyStyle}>MAD</span>
                </div>
              </label>
            </div>

            {difference !== null && (
              <div style={differenceBandStyle(difference)}>
                <span style={differenceLabelStyle}>Difference</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                  {difference > 0 ? "+" : ""}{fmt(Math.round(difference * 100) / 100)} MAD
                </strong>
              </div>
            )}

            {reconcileError && (
              <div style={reconcileErrorStyle}>{reconcileError}</div>
            )}

            <button
              type="button"
              onClick={submitReconcile}
              disabled={!Number.isFinite(parsedActual) || reconcileStatus === "saving" || reconcileStatus === "success"}
              style={{
                ...reconcileSubmitStyle,
                opacity: !Number.isFinite(parsedActual) ? 0.42 : 1,
                background: reconcileStatus === "success"
                  ? "color-mix(in srgb, var(--success) 12%, white)"
                  : reconcileStatus === "error"
                  ? "color-mix(in srgb, var(--danger) 10%, white)"
                  : "var(--accent)",
                color: reconcileStatus === "success"
                  ? "var(--success)"
                  : reconcileStatus === "error"
                  ? "var(--danger)"
                  : "var(--accent-ink)",
              }}
            >
              {reconcileStatus === "saving" && (
                <span style={spinnerStyle} />
              )}
              {reconcileStatus === "success" && <CheckIcon size={15} />}
              {reconcileStatus === "saving" ? "Saving..." :
               reconcileStatus === "success" ? "Reconciled" :
               reconcileStatus === "error" ? "Try again" :
               "Save reconciliation"}
            </button>
          </div>
        )}

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <div style={sectionStyle}>
            <p style={sectionLabelStyle}>Top categories</p>
            <div style={{ display: "grid", gap: 10 }}>
              {catBreakdown.map(({ cat, total }) => {
                if (!cat) return null;
                const pct = Math.round((total / maxCatSpend) * 100);
                return (
                  <div key={cat.id} style={catRowStyle}>
                    <div style={catIconWrapStyle}>
                      <CategoryIcon icon={cat.icon} size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={catNameStyle}>{cat.name}</span>
                        <span style={catAmtStyle}><Money value={total} /></span>
                      </div>
                      <div style={barTrackStyle}>
                        <div style={{ ...barFillStyle, width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {accountTxns.length > 0 && (
          <div style={sectionStyle}>
            <p style={sectionLabelStyle}>Recent activity</p>
            <div style={{ display: "grid", gap: 6 }}>
              {accountTxns.map(t => {
                const cat = t.category ? categories.find(c => c.id === t.category) : null;
                const isIncome = t.type === "Income";
                const isTransfer = t.type === "Transfer";
                const prefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                const amtColor = isIncome ? "var(--accent-ink)" : isTransfer ? "var(--muted)" : "var(--text2)";
                return (
                  <div key={t.id} style={txRowStyle}>
                    {isIncome || isTransfer ? (
                      <span style={txTypeIconStyle(isIncome)}>{isIncome ? "💰" : "↔"}</span>
                    ) : (
                      <CategoryIcon icon={cat?.icon ?? null} size={20} style={{ flexShrink: 0 }} />
                    )}
                    <span style={txNameStyle}>{t.name}</span>
                    <div style={txRightStyle}>
                      <span style={{ ...txAmtStyle, color: amtColor }}>{prefix}{fmt(t.amount)}</span>
                      <span style={txDateStyle}>{t.date ? fmtDate(t.date) : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {accountTxns.length === 0 && (
          <p style={emptyStyle}>No recent activity for this account.</p>
        )}

      </div>
    </BottomSheet>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...actionBtnStyle,
        background: active
          ? "color-mix(in srgb, var(--accent) 12%, white)"
          : "color-mix(in srgb, var(--surface2) 54%, white)",
        color: active ? "var(--accent-ink)" : "var(--text2)",
        boxShadow: active
          ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent)"
          : "inset 0 0 0 1px color-mix(in srgb, var(--border2) 50%, transparent)",
      }}
    >
      <span style={actionIconStyle}>{icon}</span>
      <span style={actionLabelStyle}>{label}</span>
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  borderRadius: 20,
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "18px 18px 36px",
  display: "grid",
  gap: 20,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const acctIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconCircleStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  flexShrink: 0,
};

const acctNameStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text2)",
  lineHeight: 1.2,
};

const acctTypeStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  fontWeight: 600,
};

const closeStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  paddingBottom: 4,
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const heroLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const heroValueStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.4rem, 12vw, 3.6rem)",
  fontWeight: 800,
  lineHeight: 0.92,
  letterSpacing: -1,
  color: "var(--text)",
};

const heroSubStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const statPillStyle: CSSProperties = {
  flex: 1,
  minHeight: 52,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 46%, white)",
  display: "grid",
  gap: 3,
  padding: "10px 14px",
};

const statLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const actionsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
};

const actionBtnStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  transition: "background 0.15s ease",
};

const actionIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const actionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1,
};

// Reconcile panel
const reconcilePanelStyle: CSSProperties = {
  padding: "16px 16px 18px",
  borderRadius: 16,
  background: "color-mix(in srgb, var(--surface2) 40%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
  display: "grid",
  gap: 14,
};

const reconcileTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text2)",
};

const reconcileHintStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  lineHeight: 1.5,
  marginTop: -6,
};

const reconcileRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const reconcileFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const reconcileLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const reconcileReadonlyStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  background: "color-mix(in srgb, var(--surface2) 50%, white)",
  display: "flex",
  alignItems: "center",
  padding: "0 13px",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const reconcileInputWrapStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  border: "1.5px solid color-mix(in srgb, var(--border2) 60%, transparent)",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "0 13px",
};

const reconcileInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text2)",
  padding: 0,
};

const reconcileCurrencyStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  flexShrink: 0,
};

const differenceBandStyle = (diff: number): CSSProperties => ({
  minHeight: 40,
  borderRadius: 10,
  background: diff === 0
    ? "color-mix(in srgb, var(--success) 10%, white)"
    : diff > 0
    ? "color-mix(in srgb, var(--accent) 9%, white)"
    : "color-mix(in srgb, var(--danger) 8%, white)",
  color: diff === 0
    ? "var(--success)"
    : diff > 0
    ? "var(--accent-ink)"
    : "var(--danger)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 600,
});

const differenceLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  opacity: 0.7,
};

const reconcileErrorStyle: CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  background: "color-mix(in srgb, var(--danger) 9%, white)",
  color: "var(--danger)",
  fontSize: 12,
};

const reconcileSubmitStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "all 0.2s ease",
};

const spinnerStyle: CSSProperties = {
  width: 13,
  height: 13,
  border: "2px solid color-mix(in srgb, currentColor 26%, transparent)",
  borderTopColor: "currentColor",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
  flexShrink: 0,
};

// Sections
const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
};

// Category breakdown
const catRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const catIconWrapStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: "color-mix(in srgb, var(--surface2) 64%, white)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const catNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const catAmtStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text2)",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const barTrackStyle: CSSProperties = {
  width: "100%",
  height: 3,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "var(--accent)",
  transition: "width 0.3s ease",
};

// Transactions
const txRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  background: "var(--surface)",
  borderRadius: 12,
};

const txTypeIconStyle = (isIncome: boolean): CSSProperties => ({
  flexShrink: 0,
  width: 20,
  height: 20,
  borderRadius: 7,
  background: isIncome
    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
    : "color-mix(in srgb, var(--muted) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  lineHeight: 1,
  color: isIncome ? "var(--accent-ink)" : "var(--muted)",
});

const txNameStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const txRightStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 4,
  flexShrink: 0,
};

const txAmtStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const txDateStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 400,
};

const emptyStyle: CSSProperties = {
  textAlign: "center",
  color: "var(--muted)",
  fontSize: 13,
  padding: "16px 0",
};
