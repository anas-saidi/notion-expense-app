"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CloseMonthStepState, MonthCloseAccountSnapshot, MonthCloseSummary } from "../app-types";
import { fmtDate, fmtMoney } from "../app-utils";
import { Money } from "../Money";

type CloseMonthStepProps = {
  selectedMonth: string;
  initialData?: MonthCloseSummary | null;
  endpoint?: string;
  onStateChange?: (state: CloseMonthStepState) => void;
  onOpenAddTransaction?: (payload: {
    accountId: string;
    amount: number;
    name?: string;
  }) => void;
  compact?: boolean;
};

const EMPTY_SUMMARY: MonthCloseSummary = {
  month: "",
  start: "",
  end: "",
  checklist: [],
  missingTransactions: [],
  accounts: [],
  unresolvedCount: 0,
  source: "mock",
};

export function CloseMonthStep({
  selectedMonth,
  initialData = null,
  endpoint = "/api/month-close",
  onStateChange,
  onOpenAddTransaction,
  compact = false,
}: CloseMonthStepProps) {
  const [summary, setSummary] = useState<MonthCloseSummary>(initialData ?? EMPTY_SUMMARY);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [confirmedAccounts, setConfirmedAccounts] = useState<Record<string, boolean>>({});
  const [activeRepairAccountId, setActiveRepairAccountId] = useState<string | null>(null);
  const [repairMessageByAccount, setRepairMessageByAccount] = useState<Record<string, string>>({});
  const messageTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const reloadSummary = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await fetch(`${endpoint}?month=${selectedMonth}`);
      const data = await response.json();
      if (!response.ok && !data.summary) throw new Error(data.error || "Failed to load close-month summary");
      setSummary(data.summary as MonthCloseSummary);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load close-month summary");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    Object.values(messageTimersRef.current).forEach((timer) => clearTimeout(timer));
    messageTimersRef.current = {};
    setActiveRepairAccountId(null);
    setRepairMessageByAccount({});
    setConfirmedAccounts({});
  }, [selectedMonth]);

  useEffect(() =>
    () => {
      Object.values(messageTimersRef.current).forEach((timer) => clearTimeout(timer));
      messageTimersRef.current = {};
    },
  []);

  const setTransientMessage = (accountId: string, message: string) => {
    setRepairMessageByAccount((current) => ({
      ...current,
      [accountId]: message,
    }));

    if (messageTimersRef.current[accountId]) clearTimeout(messageTimersRef.current[accountId]);
    messageTimersRef.current[accountId] = setTimeout(() => {
      setRepairMessageByAccount((current) => {
        if (!current[accountId]) return current;
        const next = { ...current };
        delete next[accountId];
        return next;
      });
      delete messageTimersRef.current[accountId];
    }, 2200);
  };

  useEffect(() => {
    if (!summary.accounts.length) return;
    setConfirmedAccounts((current) => {
      const next: Record<string, boolean> = { ...current };
      let changed = false;
      for (const account of summary.accounts) {
        if (!(account.accountId in next)) {
          next[account.accountId] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [summary.accounts]);

  const allConfirmed = summary.accounts.length === 0
    ? true
    : summary.accounts.every((account) => confirmedAccounts[account.accountId]);

  useEffect(() => {
    if (initialData && initialData.month === selectedMonth) {
      setSummary(initialData);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${endpoint}?month=${selectedMonth}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok && !data.summary) throw new Error(data.error || "Failed to load close-month summary");
        return data.summary as MonthCloseSummary;
      })
      .then((nextSummary) => {
        if (cancelled) return;
        setSummary(nextSummary);
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load close-month summary");
        setSummary(EMPTY_SUMMARY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, initialData, selectedMonth]);

  useEffect(() => {
    onStateChange?.({
      reviewed: allConfirmed,
      unresolvedCount: summary.unresolvedCount,
      needsAttention: summary.unresolvedCount > 0,
    });
  }, [allConfirmed, onStateChange, summary.unresolvedCount]);

  return (
    <section style={{ display: "grid", gap: compact ? 12 : 14 }}>
      {loading && (
        <div style={loadingStateStyle}>
          <span style={loadingSpinnerStyle} aria-hidden="true" />
          <span style={panelStyle}>Loading accounts...</span>
        </div>
      )}
      {!loading && error && <div style={panelStyle}>{error}</div>}

      {!loading && (
        <>
          {summary.accounts.length > 0 && (
            <div style={accountsListStyle}>
              <div style={reconcileHeaderStyle}>
                <div>
                  <p style={reconcileTitleStyle}>Reconcile accounts</p>
                  <p style={reconcileCopyStyle}>Confirm each balance is correct before continuing.</p>
                </div>
                <label style={selectAllLabelStyle}>
                  <input
                    type="checkbox"
                    checked={allConfirmed}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setConfirmedAccounts((current) => {
                        const next: Record<string, boolean> = { ...current };
                        for (const account of summary.accounts) {
                          next[account.accountId] = nextValue;
                        }
                        return next;
                      });
                    }}
                    style={{
                      ...confirmCheckboxBaseStyle,
                      ...(allConfirmed ? confirmCheckboxCheckedStyle : null),
                    }}
                    aria-label="Confirm all accounts"
                  />
                  <span>Select all</span>
                </label>
              </div>

              {summary.accounts.map((account) => (
                <AccountRepairRow
                  key={account.accountId}
                  account={account}
                  compact={compact}
                  confirmed={Boolean(confirmedAccounts[account.accountId])}
                  onToggleConfirmed={() =>
                    setConfirmedAccounts((current) => ({
                      ...current,
                      [account.accountId]: !current[account.accountId],
                    }))
                  }
                  onOpenAddTransaction={onOpenAddTransaction}
                  isRepairOpen={activeRepairAccountId === account.accountId}
                  message={repairMessageByAccount[account.accountId] ?? ""}
                  onToggleRepair={() =>
                    setActiveRepairAccountId((current) =>
                      current === account.accountId ? null : account.accountId,
                    )
                  }
                  onComplete={(message) => {
                    setTransientMessage(account.accountId, message);
                    setActiveRepairAccountId(null);
                  }}
                  onReconciled={() => reloadSummary()}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AccountRepairRow({
  account,
  compact = false,
  onOpenAddTransaction,
  isRepairOpen,
  confirmed,
  onToggleConfirmed,
  message,
  onToggleRepair,
  onComplete,
  onReconciled,
}: {
  account: MonthCloseAccountSnapshot;
  compact?: boolean;
  onOpenAddTransaction?: (payload: {
    accountId: string;
    amount: number;
    name?: string;
  }) => void;
  isRepairOpen: boolean;
  confirmed: boolean;
  onToggleConfirmed: () => void;
  message: string;
  onToggleRepair: () => void;
  onComplete: (message: string) => void;
  onReconciled?: () => Promise<void> | void;
}) {
  const [actualAmount, setActualAmount] = useState(
    account.currentBalance != null ? String(account.currentBalance) : "",
  );
  const [saving, setSaving] = useState(false);
  const [repairError, setRepairError] = useState("");

  useEffect(() => {
    if (!isRepairOpen) return;
    setActualAmount(account.currentBalance != null ? String(account.currentBalance) : "");
    setRepairError("");
    setSaving(false);
  }, [account.currentBalance, isRepairOpen]);

  const parsedActualAmount = Number(actualAmount.replace(/[^0-9.-]/g, ""));
  const hasValidActualAmount = Number.isFinite(parsedActualAmount);
  const currentBalance = account.currentBalance ?? 0;
  const difference = hasValidActualAmount ? Number((parsedActualAmount - currentBalance).toFixed(2)) : null;

  const handleReconcile = async () => {
    if (!hasValidActualAmount) {
      setRepairError("Enter the real amount first.");
      return;
    }
    if (account.currentBalance == null || !Number.isFinite(account.currentBalance)) {
      setRepairError("Current balance is missing.");
      return;
    }

    setSaving(true);
    setRepairError("");

    try {
      const response = await fetch("/api/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.accountId,
          currentBalance: account.currentBalance,
          actualBalance: parsedActualAmount,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save reconciliation");
      await onReconciled?.();
      onComplete(`Reconciled to ${fmtMoney(parsedActualAmount)}.`);
    } catch (error: unknown) {
      setRepairError(error instanceof Error ? error.message : "Failed to save reconciliation");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTransaction = () => {
    if (difference == null) {
      setRepairError("Enter the real amount first.");
      return;
    }
    if (!onOpenAddTransaction) {
      onComplete(`Difference ${difference > 0 ? "+" : ""}${fmtMoney(difference)}. Add transaction(s) to fix it.`);
      return;
    }
    onOpenAddTransaction({
      accountId: account.accountId,
      amount: Math.abs(difference),
      name: difference < 0 ? "Balance adjustment expense" : "Balance adjustment income",
    });
    onComplete(`Opened add transaction for ${fmtMoney(Math.abs(difference))}.`);
  };

  return (
    <div style={accountCardStyle}>
      <div style={rowStyle}>
        <label style={confirmControlStyle}>
          <span style={confirmCheckboxWrapStyle}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={onToggleConfirmed}
              style={{
                ...confirmCheckboxBaseStyle,
                ...(confirmed ? confirmCheckboxCheckedStyle : null),
              }}
              aria-label={`Confirm ${account.label}`}
            />
            <span
              style={{
                ...confirmCheckmarkStyle,
                opacity: confirmed ? 1 : 0,
              }}
              aria-hidden="true"
            >
              ✓
            </span>
          </span>
        </label>
        <div style={identityStyle}>
          <span style={accountIconStyle} aria-hidden="true">{account.icon || "•"}</span>
          <div style={identityCopyStyle}>
            <strong style={rowTitleStyle}>{account.label}</strong>
            {account.lastReconciledAt && <p style={metaStyle}>Last {fmtDate(account.lastReconciledAt)}</p>}
            {message && <p style={selectionNoteStyle}>{message}</p>}
          </div>
        </div>

        <div style={{ ...balanceWrapStyle, justifyItems: compact ? "start" : "end" }}>
          <span style={balanceValueStyle}>
            {account.currentBalance != null ? <Money value={account.currentBalance} /> : "TBD"}
          </span>
        </div>

        <div style={repairMenuAnchorStyle}>
          <button
            type="button"
            onClick={onToggleRepair}
            style={repairButtonStyle}
            aria-expanded={isRepairOpen}
            aria-label={`Repair ${account.label}`}
            title={`Repair ${account.label}`}
          >
            <RepairIcon />
          </button>

          {isRepairOpen && (
            <div style={repairMenuStyle}>
              <label style={repairFieldStyle}>
                <span style={repairFieldLabelStyle}>Real amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={actualAmount}
                  onChange={(event) => setActualAmount(event.target.value)}
                  placeholder="0"
                  aria-label={`Real amount for ${account.label}`}
                  style={repairInputStyle}
                />
              </label>

              {difference != null && (
                <div style={repairDifferenceStyle}>
                  Difference {difference > 0 ? "+" : ""}<Money value={difference} />
                </div>
              )}

              <button type="button" onClick={handleAddTransaction} style={repairOptionStyle}>
                <strong style={repairOptionTitleStyle}>Add transaction</strong>
                <span style={repairOptionCopyStyle}>Fix the difference with transaction entries.</span>
              </button>

              <button type="button" onClick={handleReconcile} style={repairOptionStyle} disabled={saving}>
                <strong style={repairOptionTitleStyle}>{saving ? "Saving..." : "Reconcile balance"}</strong>
                <span style={repairOptionCopyStyle}>Save the corrected balance to reconciliations.</span>
              </button>

              {repairError && <div style={repairErrorStyle}>{repairError}</div>}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function RepairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.27 1.75a3.25 3.25 0 0 1 3.98 3.98L7.88 10.1a1.75 1.75 0 0 1-1.24.51H4.08v-2.56c0-.46.18-.9.51-1.24l4.37-4.36Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M3.5 12.25h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const panelStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 13,
};

const loadingStateStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 0",
};

const loadingSpinnerStyle: CSSProperties = {
  width: 18,
  height: 18,
  border: "2px solid var(--border2)",
  borderTopColor: "var(--accent)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
  flexShrink: 0,
};

const accountsListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  padding: "4px 0 8px",
};

const reconcileHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
};

const reconcileTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 700,
};

const reconcileCopyStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 12,
  lineHeight: 1.4,
  marginTop: 4,
};

const selectAllLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "var(--text2)",
};

const accountCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
  gap: 12,
  alignItems: "center",
};

const confirmControlStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  minWidth: 36,
};

const confirmCheckboxWrapStyle: CSSProperties = {
  position: "relative",
  width: 22,
  height: 22,
  display: "grid",
  placeItems: "center",
};

const confirmCheckboxBaseStyle: CSSProperties = {
  appearance: "none",
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1.5px solid color-mix(in srgb, var(--success) 28%, var(--border2))",
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out, background 0.15s ease-out",
};

const confirmCheckboxCheckedStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--success) 55%, white)",
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--success) 16%, transparent)",
  borderColor: "color-mix(in srgb, var(--success) 35%, var(--border2))",
};

const confirmCheckmarkStyle: CSSProperties = {
  position: "absolute",
  color: "color-mix(in srgb, var(--success) 80%, #1a2f23)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: "none",
  transition: "opacity 0.15s ease-out",
};

const identityStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 8,
  alignItems: "center",
  minWidth: 0,
};

const identityCopyStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const rowTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 15,
  lineHeight: 1.3,
};

const accountIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  flexShrink: 0,
};

const metaStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
  fontFamily: "'DM Mono', monospace",
};

const balanceValueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 16,
  lineHeight: 1.1,
};

const balanceWrapStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  minWidth: 72,
};

const repairButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  padding: 0,
  borderRadius: 12,
  border: "none",
  background: "color-mix(in srgb, var(--surface2) 52%, white)",
  color: "var(--text)",
};

const repairMenuAnchorStyle: CSSProperties = {
  position: "relative",
};

const repairMenuStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 180,
  padding: 8,
  borderRadius: 18,
  background: "color-mix(in srgb, var(--surface) 94%, white)",
  boxShadow: "0 14px 30px rgba(15, 17, 20, 0.12)",
  zIndex: 10,
};

const repairOptionStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "color-mix(in srgb, var(--surface2) 38%, white)",
  color: "var(--text)",
};

const repairFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "4px 4px 2px",
};

const repairFieldLabelStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const repairInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "none",
  background: "color-mix(in srgb, var(--surface2) 58%, white)",
  color: "var(--text)",
  fontSize: 15,
};

const repairOptionTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 13,
  lineHeight: 1.3,
};

const repairOptionCopyStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 12,
  lineHeight: 1.4,
};

const repairDifferenceStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 12,
  lineHeight: 1.4,
  padding: "0 4px",
  fontFamily: "'DM Mono', monospace",
};

const repairErrorStyle: CSSProperties = {
  color: "var(--danger)",
  fontSize: 12,
  lineHeight: 1.4,
  padding: "0 4px 4px",
};

const selectionNoteStyle: CSSProperties = {
  color: "color-mix(in srgb, var(--success) 30%, var(--text2))",
  fontSize: 11,
  lineHeight: 1.4,
  letterSpacing: 0.1,
  opacity: 0.85,
};
