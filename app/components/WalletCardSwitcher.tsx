import { type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { BUDGET_SCOPE_LABELS, fmt } from "./app-utils";

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  onCardTap?: () => void;
};

const SCOPES: BudgetScope[] = ["joint", "anas", "salma"];

const SCOPE_LABEL: Record<BudgetScope, string> = {
  joint: "Together",
  anas: "Anas",
  salma: "Salma",
};

const SCOPE_CONTEXT: Record<BudgetScope, string> = {
  joint: "shared month",
  anas: "personal room",
  salma: "personal room",
};

const getWalletStatus = (available: number | null, planned: number | null) => {
  if (planned === null || planned <= 0) return "Needs a plan";
  if (available === null) return "Quiet";
  if (available < 0) return "Over";
  if (available / planned <= 0.18) return "Low";
  return "On track";
};

const getProgress = (available: number | null, planned: number | null) => {
  if (available === null || planned === null || planned <= 0) return 0;
  const spent = Math.max(0, planned - available);
  return Math.min(100, Math.round((spent / planned) * 100));
};

const getScopeColor = (scope: BudgetScope) => {
  if (scope === "anas") return "var(--partner-husband-strong)";
  if (scope === "salma") return "var(--partner-wife-strong)";
  return "var(--accent-ink)";
};

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, onCardTap }: WalletCardSwitcherProps) {
  const currentSummary = monthlySummary ?? walletSummaries?.[value];
  const available = currentSummary ? currentSummary.totalAssigned - currentSummary.totalSpent : null;
  const planned = currentSummary?.totalAssigned ?? null;
  const progress = getProgress(available, planned);
  const status = getWalletStatus(available, planned);
  const isOver = available !== null && available < 0;
  const hasPlan = planned !== null && planned > 0;

  return (
    <section style={wrapStyle} aria-label="Wallet overview">
      <div style={pillRailStyle} role="tablist" aria-label="Budget view">
        {SCOPES.map((scope) => {
          const isActive = scope === value;
          const summary = walletSummaries?.[scope] ?? (isActive ? currentSummary : null);
          const scopeAvailable = summary ? summary.totalAssigned - summary.totalSpent : null;

          if (isActive) {
            return (
              <button
                key={scope}
                type="button"
                role="tab"
                aria-selected={true}
                aria-label={`${BUDGET_SCOPE_LABELS[scope]} wallet (active)`}
                onClick={onCardTap}
                style={activePillStyle(scope)}
              >
                <span style={pillInitialBadgeStyle(scope)}>
                  {SCOPE_INITIAL[scope]}
                </span>
                <span style={pillNameStyle(scope)}>{SCOPE_LABEL[scope]}</span>
                <span style={pillBalanceStyle(scope)}>
                  {scopeAvailable !== null ? fmt(Math.abs(scopeAvailable)) : "—"}
                </span>
              </button>
            );
          }

          return (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={false}
              aria-label={`Switch to ${BUDGET_SCOPE_LABELS[scope]} wallet`}
              onClick={() => onChange(scope)}
              style={inactivePillStyle(scope)}
            >
              <span style={inactiveInitialStyle(scope)}>{SCOPE_INITIAL[scope]}</span>
            </button>
          );
        })}
      </div>

      <button
        key={value}
        type="button"
        onClick={onCardTap}
        style={statementStyle}
        aria-label={`${BUDGET_SCOPE_LABELS[value]} wallet details`}
      >
        <span style={statusBadgeWrapStyle}>
          <span style={statusBadgeStyle(status)}>
            <span style={statusDotStyle(status)} aria-hidden="true" />
            {status}
          </span>
          <span style={statusContextStyle}>· {SCOPE_CONTEXT[value]}</span>
        </span>

        <span style={sentenceStyle}>
          <strong style={nameStyle(value)}>{SCOPE_LABEL[value]}</strong>
          {" has "}
          <strong style={amountStyle(isOver)}>
            {fmt(Math.abs(available ?? 0))}
            <span style={currencyStyle}> MAD</span>
          </strong>
          {isOver ? " to cover" : " left"}
        </span>

        <span style={trackStyle} aria-hidden="true">
          <span style={{ ...fillStyle(value, isOver), width: `${progress}%` }} />
        </span>

        <span style={metaStyle}>
          {hasPlan ? `${fmt(planned!)} MAD planned · ${progress}% used` : "No plan yet — tap to set one up"}
        </span>
      </button>
    </section>
  );
}

const SCOPE_INITIAL: Record<BudgetScope, string> = {
  joint: "T",
  anas: "A",
  salma: "S",
};

const SCOPE_BG: Record<BudgetScope, string> = {
  joint: "var(--accent)",
  anas: "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

const SCOPE_INK: Record<BudgetScope, string> = {
  joint: "var(--accent-ink)",
  anas: "#ffffff",
  salma: "#ffffff",
};

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 20,
  padding: "0 24px",
};

const pillRailStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  overflowX: "auto",
  padding: "4px 0",
};

const activePillStyle = (scope: BudgetScope): CSSProperties => ({
  flex: "0 0 116px",
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid transparent",
  background: SCOPE_BG[scope],
  color: SCOPE_INK[scope],
  padding: "6px 9px",
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  gridTemplateRows: "auto auto",
  alignItems: "center",
  gap: "1px 7px",
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "none",
  animation: "categorySelectIn 0.24s cubic-bezier(0.22, 1, 0.36, 1) both",
  transition: "box-shadow 0.22s ease",
});

const pillInitialBadgeStyle = (scope: BudgetScope): CSSProperties => ({
  gridColumn: "1 / 2",
  gridRow: "1 / 3",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontSize: 11,
  fontWeight: 800,
  color: SCOPE_INK[scope],
  flexShrink: 0,
});

const pillNameStyle = (scope: BudgetScope): CSSProperties => ({
  gridColumn: "2 / 3",
  gridRow: "1 / 2",
  fontSize: 11,
  fontWeight: 800,
  fontFamily: "var(--font-display)",
  lineHeight: 1,
  color: SCOPE_INK[scope],
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const pillBalanceStyle = (scope: BudgetScope): CSSProperties => ({
  gridColumn: "2 / 3",
  gridRow: "2 / 3",
  fontFamily: "'DM Mono', monospace",
  fontSize: 9,
  fontWeight: 500,
  lineHeight: 1,
  color: SCOPE_INK[scope],
  opacity: 0.7,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const inactivePillStyle = (scope: BudgetScope): CSSProperties => ({
  flex: "0 0 36px",
  width: 36,
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, var(--border) 38%, transparent)",
  background: "color-mix(in srgb, var(--surface) 90%, white)",
  color: getScopeColor(scope),
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "none",
  transition: "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease",
});

const inactiveInitialStyle = (scope: BudgetScope): CSSProperties => ({
  fontFamily: "var(--font-display)",
  fontSize: 12,
  fontWeight: 800,
  color: getScopeColor(scope),
  opacity: 0.6,
  lineHeight: 1,
});

const statementStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  padding: 0,
  display: "grid",
  gap: 12,
  textAlign: "left",
  cursor: "pointer",
  animation: "fadeUp 0.22s ease both",
};

const STATUS_COLOR: Record<string, string> = {
  "On track": "var(--accent)",
  "Low": "var(--warning)",
  "Over": "var(--danger)",
  "Needs a plan": "var(--muted)",
  "Quiet": "var(--muted)",
};

const statusBadgeWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const statusBadgeStyle = (status: string): CSSProperties => {
  const color = STATUS_COLOR[status] ?? "var(--muted)";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px 3px 6px",
    borderRadius: 999,
    background: `color-mix(in srgb, ${color} 12%, var(--surface2))`,
    border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.2,
    color: `color-mix(in srgb, ${color} 80%, var(--text2))`,
  };
};

const statusDotStyle = (status: string): CSSProperties => {
  const color = STATUS_COLOR[status] ?? "var(--muted)";
  const isPulsing = status === "Low" || status === "Over";
  return {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
    animation: isPulsing ? "pulse 1.6s ease infinite" : undefined,
  };
};

const statusContextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.2,
};

const sentenceStyle: CSSProperties = {
  display: "block",
  maxWidth: 620,
  fontSize: "clamp(28px, 7vw, 48px)",
  lineHeight: 0.98,
  fontFamily: "var(--font-display)",
  fontWeight: 760,
  color: "var(--text)",
};

const nameStyle = (scope: BudgetScope): CSSProperties => ({
  fontWeight: 880,
  color: scope === "anas"
    ? "var(--partner-husband)"
    : scope === "salma"
    ? "var(--partner-wife)"
    : "inherit",
});

const amountStyle = (isOver: boolean): CSSProperties => ({
  fontWeight: 880,
  color: isOver ? "var(--danger)" : "var(--text)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
});

const currencyStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: "0.28em",
  fontWeight: 700,
  color: "var(--muted)",
};

const trackStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: 7,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 78%, white)",
  overflow: "hidden",
};

const fillStyle = (scope: BudgetScope, isOver: boolean): CSSProperties => ({
  display: "block",
  height: "100%",
  borderRadius: 999,
  background: isOver ? "var(--danger)" : getScopeColor(scope),
  transition: "width 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
});

const metaStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  color: "var(--muted)",
};
