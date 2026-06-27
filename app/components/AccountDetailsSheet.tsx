"use client";

import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BottomSheet } from "./ui/BottomSheet";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Money } from "./Money";
import type { Account, Category, Transaction } from "./app-types";
import { fmt, fmtDate, monthBounds } from "./app-utils";
import {
  BanknoteIcon,
  TransferIcon,
  ScaleIcon,
  XIcon,
  CheckIcon,
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrendingUpIcon,
} from "./ui/icons";

type AccountDetailsSheetProps = {
  open: boolean;
  account: Account | null;
  transactions: Transaction[];
  categories: Category[];
  homeMonth: string;
  onClose: () => void;
  onMove: (account: Account) => void;
  onIncome: (account: Account) => void;
  onReconcileSuccess: (message: string) => void;
};

type ReconcileStatus = "idle" | "saving" | "success" | "error";

const CURRENT_MONTH = () => new Date().toISOString().slice(0, 7);

function fmtMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function AccountDetailsSheet({
  open,
  account,
  transactions,
  categories,
  homeMonth,
  onClose,
  onMove,
  onIncome,
  onReconcileSuccess,
}: AccountDetailsSheetProps) {
  const [showReconcile, setShowReconcile] = useState(false);
  const [actualBalance, setActualBalance] = useState("");
  const [reconcileStatus, setReconcileStatus] = useState<ReconcileStatus>("idle");
  const [reconcileError, setReconcileError] = useState("");

  // Balance history chart
  const [showChart, setShowChart] = useState(false);
  const [chartMonth, setChartMonth] = useState(homeMonth);
  const [chartTxns, setChartTxns] = useState<Transaction[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Activity list toggle
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Reset when sheet opens for a (possibly different) account
  useEffect(() => {
    if (open) {
      setChartMonth(homeMonth);
      setShowChart(false);
      setChartTxns([]);
      setShowAllActivity(false);
    }
  }, [open, homeMonth]);

  // Fetch transactions for the chart month
  useEffect(() => {
    if (!showChart || !account || !chartMonth) return;
    let cancelled = false;
    setChartLoading(true);
    const { start, end } = monthBounds(`${chartMonth}-01`);
    fetch(`/api/transactions?start=${start}&end=${end}&page_size=200`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const id = account.id;
        const acctTxns = (data.transactions ?? []).filter((t: Transaction) =>
          t.type === "Transfer"
            ? t.fromAccountId === id || t.toAccountId === id
            : t.accountId === id,
        );
        setChartTxns(acctTxns);
        setChartLoading(false);
      })
      .catch(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [showChart, chartMonth, account]);

  const chartData = useMemo(() => {
    if (!chartMonth) return { points: [], daysInMonth: 30, todayDay: 30, netChange: 0 };
    const [y, m] = chartMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayDay = chartMonth === CURRENT_MONTH() ? new Date().getDate() : daysInMonth;

    const incomeByDay = new Array(daysInMonth + 1).fill(0);
    const expenseByDay = new Array(daysInMonth + 1).fill(0);
    const id = account?.id;
    for (const t of chartTxns) {
      if (!t.date) continue;
      const day = parseInt(t.date.split("-")[2], 10);
      if (day < 1 || day > daysInMonth) continue;
      if (t.type === "Transfer") {
        // transfer in → balance goes up; transfer out → balance goes down
        if (t.toAccountId === id) incomeByDay[day] += t.amount;
        else expenseByDay[day] += t.amount;
      } else if (t.type === "Income") {
        incomeByDay[day] += t.amount;
      } else {
        expenseByDay[day] += t.amount;
      }
    }

    // For current month derive the actual start balance; for past months start from 0 (net movement)
    const totalIn  = incomeByDay.reduce((s, v) => s + v, 0);
    const totalOut = expenseByDay.reduce((s, v) => s + v, 0);
    const isNow = chartMonth === CURRENT_MONTH();
    const startBalance = isNow ? (account?.balance ?? 0) + totalOut - totalIn : 0;

    let balance = startBalance;
    const points = Array.from({ length: todayDay + 1 }, (_, d) => {
      if (d > 0) balance = balance + incomeByDay[d] - expenseByDay[d];
      return { day: d, balance: Math.round(balance) };
    });
    const netChange = Math.round((points[points.length - 1]?.balance ?? 0) - startBalance);
    return { points, daysInMonth, todayDay, netChange };
  }, [chartTxns, chartMonth, account]);

  const shiftChartMonth = (delta: number) => {
    const [y, m] = chartMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (delta > 0 && next > CURRENT_MONTH()) return;
    setChartMonth(next);
  };
  const canGoNext = chartMonth < CURRENT_MONTH();
  const xTicks = [1, Math.round(chartData.daysInMonth / 2), chartData.daysInMonth]
    .filter(t => t <= chartData.todayDay);
  const lastPoint = chartData.points[chartData.points.length - 1];

  const handleClose = () => {
    setShowReconcile(false);
    setActualBalance("");
    setReconcileStatus("idle");
    setReconcileError("");
    setShowChart(false);
    setChartTxns([]);
    setShowAllActivity(false);
    onClose();
  };

  // All loaded transactions for this account (for recent activity list)
  const accountTxns = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter(t => t.accountId === account.id)
      .slice(0, 20);
  }, [account, transactions]);

  // homeMonth transactions involving this account — expenses/income by accountId,
  // transfers by fromAccountId or toAccountId
  const monthTxns = useMemo(() => {
    if (!account) return [];
    const id = account.id;
    return transactions.filter(t => {
      if (!t.date?.startsWith(homeMonth)) return false;
      if (t.type === "Transfer") return t.fromAccountId === id || t.toAccountId === id;
      return t.accountId === id;
    });
  }, [account, transactions, homeMonth]);

  // Category spend breakdown — expenses only (transfers have no category)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      if (!t.category || (t.type && t.type !== "Expense")) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([catId, total]) => ({ cat: categories.find(c => c.id === catId) ?? null, total }))
      .filter(({ cat }) => cat !== null)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthTxns, categories]);

  const maxCatSpend = catBreakdown[0]?.total ?? 1;

  // Out = expenses + transfers out; In = income + transfers in
  const totalSpentFromAcct = useMemo(
    () => monthTxns
      .filter(t =>
        (!t.type || t.type === "Expense") ||
        (t.type === "Transfer" && t.fromAccountId === account?.id),
      )
      .reduce((s, t) => s + t.amount, 0),
    [monthTxns, account],
  );
  const totalIncomeToAcct = useMemo(
    () => monthTxns
      .filter(t =>
        t.type === "Income" ||
        (t.type === "Transfer" && t.toAccountId === account?.id),
      )
      .reduce((s, t) => s + t.amount, 0),
    [monthTxns, account],
  );

  // All activity for this month, sorted newest first
  const allActivityTxns = useMemo(() => {
    return [...monthTxns].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [monthTxns]);

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
          <div style={heroTopRowStyle}>
            <p style={heroLabelStyle}>Current balance</p>
            <button
              type="button"
              onClick={() => setShowChart(v => !v)}
              aria-label={showChart ? "Hide balance history" : "Show balance history"}
              style={{
                ...chartToggleBtnStyle,
                background: showChart
                  ? "color-mix(in srgb, var(--accent) 12%, white)"
                  : "transparent",
                color: showChart ? "var(--accent-ink)" : "var(--muted)",
              }}
            >
              <TrendingUpIcon size={13} strokeWidth={2} />
            </button>
          </div>
          <p style={{ ...heroValueStyle, color: isNegative ? "var(--danger)" : "var(--text)" }}>
            <Money value={account.balance ?? 0} absolute={isNegative} />
          </p>
          {account.readyToAssign != null && (
            <p style={heroSubStyle}>
              {fmt(account.readyToAssign)} MAD ready to assign
            </p>
          )}
        </div>

        {/* Balance history chart */}
        {showChart && (
          <div style={chartPanelStyle}>
            {/* Month nav */}
            <div style={chartNavStyle}>
              <button
                type="button"
                onClick={() => shiftChartMonth(-1)}
                aria-label="Previous month"
                style={chartNavBtnStyle}
              >
                <ChevronLeftIcon size={14} strokeWidth={2.5} />
              </button>
              <span style={chartMonthLabelStyle}>{fmtMonth(chartMonth)}</span>
              <button
                type="button"
                onClick={() => shiftChartMonth(1)}
                disabled={!canGoNext}
                aria-label="Next month"
                style={{ ...chartNavBtnStyle, opacity: canGoNext ? 1 : 0.28 }}
              >
                <ChevronRightIcon size={14} strokeWidth={2.5} />
              </button>
            </div>

            {chartLoading ? (
              <div style={chartLoadingStyle}>
                <span style={spinnerStyle} />
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={148}>
                  <ComposedChart data={chartData.points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="acctBalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} strokeOpacity={0.55} />
                    <XAxis
                      dataKey="day"
                      ticks={xTicks}
                      tick={{ fontSize: 9, fill: "var(--muted)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--muted)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                      width={34}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border2)",
                        borderRadius: 10,
                        fontSize: 11,
                        color: "var(--text2)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value) => [`${fmt(Number(value))} MAD`, "Balance"]}
                      labelFormatter={day => `Day ${day}`}
                      cursor={{ stroke: "var(--border2)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#acctBalGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Net change footer */}
                <div style={chartFooterStyle}>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>
                    {fmt(Math.abs(lastPoint?.balance ?? 0))} MAD
                  </span>
                  {chartData.netChange !== 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: chartData.netChange > 0 ? "#10b981" : "var(--danger)",
                    }}>
                      {chartData.netChange > 0 ? "+" : ""}{fmt(chartData.netChange)} this month
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stat pills — only visible when chart is open */}
        {showChart && (totalSpentFromAcct > 0 || totalIncomeToAcct > 0) && (
          <div style={statsRowStyle}>
            {totalSpentFromAcct > 0 && (
              <div style={{ ...statPillStyle, background: "color-mix(in srgb, var(--danger) 8%, white)" }}>
                <ArrowDownIcon size={13} strokeWidth={2.5} style={{ color: "var(--danger)", flexShrink: 0 }} />
                <strong style={{ ...statValueStyle, color: "var(--danger)" }}><Money value={totalSpentFromAcct} /></strong>
              </div>
            )}
            {totalIncomeToAcct > 0 && (
              <div style={{ ...statPillStyle, background: "color-mix(in srgb, #10b981 8%, white)" }}>
                <ArrowUpIcon size={13} strokeWidth={2.5} style={{ color: "#10b981", flexShrink: 0 }} />
                <strong style={{ ...statValueStyle, color: "#10b981" }}><Money value={totalIncomeToAcct} /></strong>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={actionsRowStyle}>
          <ActionBtn
            icon={<TransferIcon size={18} strokeWidth={2.2} />}
            ariaLabel="Move money"
            bg="color-mix(in srgb, #3b82f6 11%, white)"
            ink="#3b82f6"
            onClick={() => { handleClose(); onMove(account); }}
          />
          <ActionBtn
            icon={<BanknoteIcon size={18} strokeWidth={2.2} />}
            ariaLabel="Add income"
            bg="color-mix(in srgb, #10b981 11%, white)"
            ink="#10b981"
            onClick={() => { handleClose(); onIncome(account); }}
          />
          <ActionBtn
            icon={<ScaleIcon size={18} strokeWidth={2.2} />}
            ariaLabel="Reconcile balance"
            bg={showReconcile
              ? "color-mix(in srgb, var(--accent) 12%, white)"
              : "color-mix(in srgb, var(--surface2) 54%, white)"}
            ink={showReconcile ? "var(--accent-ink)" : "var(--text2)"}
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

        {/* Activity list */}
        {(() => {
          const shownTxns = showAllActivity ? allActivityTxns : accountTxns;
          const acctId = account.id;
          return (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <p style={sectionLabelStyle}>
                  {showAllActivity ? `All · ${fmtMonth(homeMonth)}` : "Recent activity"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllActivity(v => !v)}
                  style={seeAllBtnStyle}
                >
                  {showAllActivity ? "Recent" : "All"}
                </button>
              </div>
              {shownTxns.length === 0 ? (
                <p style={emptyStyle}>No activity{showAllActivity ? ` in ${fmtMonth(homeMonth)}` : ""}.</p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {shownTxns.map(t => {
                    const cat = t.category ? categories.find(c => c.id === t.category) : null;
                    const isIncome = t.type === "Income";
                    const isTransferIn = t.type === "Transfer" && t.toAccountId === acctId;
                    const isTransferOut = t.type === "Transfer" && t.fromAccountId === acctId;
                    const isPositive = isIncome || isTransferIn;
                    const prefix = isPositive ? "+" : "−";
                    const amtColor = isIncome ? "#10b981" : isTransferIn ? "#10b981" : isTransferOut ? "var(--danger)" : "var(--text2)";
                    return (
                      <div key={t.id} style={txRowStyle}>
                        {isIncome || isTransferIn || isTransferOut ? (
                          <span style={txTypeIconStyle(isPositive)}>
                            {isIncome ? "💰" : "↔"}
                          </span>
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
              )}
            </div>
          );
        })()}

      </div>
    </BottomSheet>
  );
}

function ActionBtn({
  icon,
  ariaLabel,
  onClick,
  bg = "color-mix(in srgb, var(--surface2) 54%, white)",
  ink = "var(--text2)",
}: {
  icon: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  bg?: string;
  ink?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ ...actionBtnStyle, background: bg, color: ink }}
    >
      <span style={actionIconStyle}>{icon}</span>
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

const heroTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const chartToggleBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease, color 0.15s ease",
  flexShrink: 0,
};

const chartPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "2px 0 0",
};

const chartNavStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const chartNavBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "none",
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const chartMonthLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text2)",
  flex: 1,
  textAlign: "center",
};

const chartLoadingStyle: CSSProperties = {
  height: 148,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const chartFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: 2,
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
  minHeight: 46,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 46%, white)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 14px",
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
  height: 52,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease, color 0.15s ease",
};

const actionIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const seeAllBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--accent-ink)",
  cursor: "pointer",
  padding: "2px 0",
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
