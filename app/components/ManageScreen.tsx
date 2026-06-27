"use client";

import { useMemo, type CSSProperties } from "react";
import type { Account } from "./app-types";
import { Money } from "./Money";
import { XIcon } from "./ui/icons";
import { fmt } from "./app-utils";

/* ── SVG arc helpers ─────────────────────────────────────────────── */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const sweep = Math.min(sweepDeg, 359.9);
  if (sweep <= 0) return "";
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, startDeg + sweep);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const CHART_COLORS = [
  "var(--accent)",
  "var(--partner-husband)",
  "var(--partner-wife)",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#60a5fa",
];

/* ── Types ───────────────────────────────────────────────────────── */

type ManageScreenProps = {
  accounts: Account[];
  onClose: () => void;
  onOpenDetails: (account: Account) => void;
};

/* ── Main screen ─────────────────────────────────────────────────── */

export function ManageScreen({
  accounts,
  onClose,
  onOpenDetails,
}: ManageScreenProps) {
  const totalReady = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.readyToAssign ?? 0), 0),
    [accounts],
  );

  return (
    <main style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Manage</div>
          <h1 style={titleStyle}>Accounts</h1>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
          <XIcon size={18} />
        </button>
      </header>

      <section style={contentStyle}>
        <div style={summaryBandStyle}>
          <span>Total ready to assign</span>
          <strong><Money value={totalReady} /></strong>
        </div>

        {/* Balance distribution donut */}
        <AccountBalanceChart accounts={accounts} />

        <div style={listStyle}>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => onOpenDetails(account)}
              aria-label={`View ${account.label} details`}
              style={accountRowStyle}
            >
              <div style={accountIconStyle}>{account.icon}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={rowTitleStyle}>{account.label}</strong>
                <p style={rowMetaStyle}>{account.type ?? "Account"}</p>
              </div>
              <div style={amountStackStyle}>
                <strong><Money value={account.balance ?? 0} /></strong>
                <span>Ready <Money value={account.readyToAssign ?? 0} /></span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ── Balance distribution chart ─────────────────────────────────── */

function AccountBalanceChart({ accounts }: { accounts: Account[] }) {
  const chartData = useMemo(() => {
    const items = accounts
      .filter(a => (a.balance ?? 0) > 0)
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    const total = items.reduce((s, a) => s + (a.balance ?? 0), 0);
    return { items, total };
  }, [accounts]);

  if (chartData.total === 0 || chartData.items.length === 0) return null;

  const { items, total } = chartData;
  const cx = 70, cy = 70, r = 54, sw = 16;
  const GAP = items.length > 1 ? 3 : 0;
  let angle = -90;
  const segments = items.map((account, i) => {
    const val = account.balance ?? 0;
    const fullSweep = (val / total) * 360;
    const sweep = Math.max(0, fullSweep - GAP);
    const path = arcPath(cx, cy, r, angle, sweep);
    angle += fullSweep;
    return { account, val, path, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return (
    <div style={chartWrapStyle}>
      {/* Centered donut */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 140, height: 140 }}>
          <svg width={140} height={140} viewBox="0 0 140 140" aria-hidden="true">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={sw} />
            {segments.map((seg, i) =>
              seg.path ? (
                <path key={i} d={seg.path} fill="none" stroke={seg.color} strokeWidth={sw} strokeLinecap="butt" />
              ) : null
            )}
          </svg>
          <div style={chartCenterStyle}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {fmt(Math.round(total))}
            </span>
            <span style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, letterSpacing: 0.3 }}>MAD total</span>
          </div>
        </div>
      </div>

      {/* Legend — 2 columns */}
      <div style={chartLegendStyle}>
        {segments.map(({ account, val, color }) => (
          <div key={account.id} style={chartLegendRowStyle}>
            <span style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: color }} />
            <span style={{ fontSize: 13, lineHeight: 1 }}>{account.icon}</span>
            <span style={chartLegendNameStyle}>{account.label}</span>
            <span style={chartLegendAmtStyle}>{fmt(Math.round(val))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */

const screenStyle: CSSProperties = {
  minHeight: "100dvh",
  padding: "calc(env(safe-area-inset-top, 0px) + 20px) calc(env(safe-area-inset-right, 0px) + 18px) calc(env(safe-area-inset-bottom, 0px) + 24px) calc(env(safe-area-inset-left, 0px) + 18px)",
  background: "var(--bg)",
  display: "grid",
  alignContent: "start",
  gap: 22,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 34,
  lineHeight: 0.95,
  color: "var(--text)",
};

const closeStyle: CSSProperties = {
  minWidth: 44,
  height: 44,
  padding: "0 12px",
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const rowTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const summaryBandStyle: CSSProperties = {
  minHeight: 58,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--accent) 9%, white)",
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "0 14px",
  fontSize: 13,
};

const accountRowStyle: CSSProperties = {
  minHeight: 72,
  borderRadius: 14,
  border: "none",
  background: "var(--surface)",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const accountIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 58%, white)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const amountStackStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  justifyItems: "end",
  fontSize: 12,
  color: "var(--text2)",
  marginLeft: "auto",
  flexShrink: 0,
};

/* ── Chart styles ────────────────────────────────────────────────── */

const chartWrapStyle: CSSProperties = {
  borderRadius: 16,
  background: "var(--surface)",
  padding: "16px 16px 18px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  display: "grid",
  gap: 16,
};

const chartCenterStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const chartLegendStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px 12px",
};

const chartLegendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const chartLegendNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const chartLegendAmtStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text2)",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};
