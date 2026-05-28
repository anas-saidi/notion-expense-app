import { useState, type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { fmt } from "./app-utils";

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  leftToSpendByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
};

const SCOPES: BudgetScope[] = ["joint", "anas", "salma"];

const SCOPE_EMOJI: Record<BudgetScope, string> = {
  joint: "👫",
  anas:  "👨",
  salma: "👩",
};

const SCOPE_LABEL: Record<BudgetScope, string> = {
  joint: "Couple",
  anas:  "Anas",
  salma: "Salma",
};

const SCOPE_BG: Record<BudgetScope, string> = {
  joint: "var(--accent)",
  anas:  "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

const SCOPE_INK: Record<BudgetScope, string> = {
  joint: "var(--accent-ink)",
  anas:  "#ffffff",
  salma: "#ffffff",
};

/* Subtle background wash — each scope tints the whole hero */
const SCOPE_WASH: Record<BudgetScope, string> = {
  joint: "color-mix(in srgb, var(--accent) 6%, var(--bg))",
  anas:  "color-mix(in srgb, var(--partner-husband) 8%, var(--bg))",
  salma: "color-mix(in srgb, var(--partner-wife) 8%, var(--bg))",
};

/* Curve stroke color per scope */
const SCOPE_CURVE_COLOR: Record<BudgetScope, string> = {
  joint: "var(--accent)",
  anas:  "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

const STATUS_COLOR: Record<string, string> = {
  "On track":  "var(--accent-ink)",
  "Together":  "var(--accent-ink)",
  "Low":       "var(--warning)",
  "Over":      "var(--danger)",
  "No plan":   "var(--muted)",
  "Quiet":     "var(--muted)",
};

const getScopeColor = (scope: BudgetScope) => {
  if (scope === "anas")  return "var(--partner-husband)";
  if (scope === "salma") return "var(--partner-wife)";
  return "var(--accent)";
};

const getStatus = (available: number | null, planned: number | null, scope?: BudgetScope) => {
  if (planned === null || planned <= 0) return "No plan";
  if (available === null) return "Quiet";
  if (available < 0) return "Over";
  if (available / planned <= 0.18) return "Low";
  return scope === "joint" ? "Together" : "On track";
};

const getProgress = (available: number | null, planned: number | null) => {
  if (available === null || planned === null || planned <= 0) return 0;
  const spent = Math.max(0, planned - available);
  return Math.min(100, Math.round((spent / planned) * 100));
};


export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, leftToSpendByScope, balanceByScope }: WalletCardSwitcherProps) {
  const [hovered, setHovered]   = useState<BudgetScope | null>(null);
  const [pressed, setPressed]   = useState<BudgetScope | null>(null);

  const currentSummary = monthlySummary ?? walletSummaries?.[value];
  // Hero number: real account balance by scope (from Notion accounts database)
  const balance   = balanceByScope != null ? balanceByScope[value] : null;
  // Curve/progress still uses category-based left-to-spend for spend % display
  const available = leftToSpendByScope != null ? leftToSpendByScope[value] : currentSummary ? currentSummary.totalAssigned - currentSummary.totalSpent : null;
  const planned   = currentSummary?.totalAssigned ?? null;
  const progress  = getProgress(available, planned);
  const status    = getStatus(balance, planned, value);
  const isOver    = balance !== null && balance < 0;
  const hasPlan   = planned !== null && planned > 0;

  return (
    <section
      style={{
        ...wrapStyle,
        background: SCOPE_WASH[value],
        transition: "background 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      aria-label="Wallet overview"
    >

      {/* Scope switcher */}
      <div style={pillRailStyle} role="tablist" aria-label="Budget view">
        {SCOPES.map((scope) => {
          const isActive = scope === value;
          const isHov    = hovered === scope && !isActive;
          const isPrs    = pressed === scope;

          return (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={isActive ? `${scope} wallet, active` : `Switch to ${scope} wallet`}
              onClick={() => onChange(scope)}
              onMouseEnter={() => setHovered(scope)}
              onMouseLeave={() => { setHovered(null); setPressed(null); }}
              onMouseDown={() => setPressed(scope)}
              onMouseUp={() => setPressed(null)}
              style={
                isActive
                  ? {
                      ...activePillStyle(scope),
                      transform: isPrs ? "scale(0.95)" : "translateY(-1px)",
                    }
                  : {
                      ...inactivePillStyle(scope),
                      opacity: isPrs ? 0.9 : isHov ? 0.75 : 0.45,
                      transform: isPrs ? "scale(0.93)" : isHov ? "translateY(-2px)" : "none",
                    }
              }
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{SCOPE_EMOJI[scope]}</span>
              {isActive && <span style={activeLabelStyle}>{SCOPE_LABEL[scope]}</span>}

            </button>
          );
        })}
      </div>

      {/* Hero */}
      <div style={heroStyle} key={value}>

        {/* Status + number */}
        <div style={numberGroupStyle}>
          <span style={statusStyle(status)}>{status}</span>
          <div style={amountRowStyle}>
            <span style={bigNumberStyle(isOver)}>
              {fmt(Math.abs(balance ?? available ?? 0))}
            </span>
            <span style={unitStyle(isOver)}>
              MAD {isOver ? "over" : "balance"}
            </span>
          </div>
        </div>

        {/* Curve chart + caption */}
        {(() => {
          const t = progress / 100;
          const curveColor = isOver
            ? "var(--spend-over)"
            : progress >= 85 ? "var(--spend-warn)"
            : progress >= 65 ? "var(--spend-caution)"
            : SCOPE_CURVE_COLOR[value];
          // Quadratic bezier M 0,37 Q 120,2 240,37
          // x(t) = 240t  →  curX = 240 * t
          // y(t) = 37 - 70*t*(1-t)
          const curX = 240 * t;
          const curY = 37 - 70 * t * (1 - t);
          return (
            <div style={curveGroupStyle}>
              <svg
                viewBox="0 0 240 42"
                style={{ width: "100%", height: 42, display: "block", overflow: "visible" }}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`wcs-fill-${value}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={curveColor} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={curveColor} stopOpacity="0.03" />
                  </linearGradient>
                  <clipPath id={`wcs-clip-${value}`}>
                    <rect x="0" y="0" height="42"
                      style={{
                        width: hasPlan ? curX : 0,
                        transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />
                  </clipPath>
                </defs>

                {/* Faint full-arc track */}
                <path
                  d="M 0,37 Q 120,2 240,37"
                  fill="none"
                  stroke="var(--surface2)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* Tinted fill under curve, clipped to progress */}
                <path
                  d="M 0,37 Q 120,2 240,37 L 240,42 L 0,42 Z"
                  fill={`url(#wcs-fill-${value})`}
                  clipPath={`url(#wcs-clip-${value})`}
                />

                {/* Active stroke, clipped to progress */}
                <path
                  d="M 0,37 Q 120,2 240,37"
                  fill="none"
                  stroke={curveColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  clipPath={`url(#wcs-clip-${value})`}
                />

                {/* Current position dot */}
                {hasPlan && progress > 0 && (
                  <circle
                    cx={0} cy={0} r="4"
                    fill={curveColor}
                    style={{
                      transform: `translate(${curX}px, ${curY}px)`,
                      transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                )}
              </svg>

              <div style={captionRowStyle}>
                {hasPlan ? (
                  <>
                    <span style={captionStyle}>{progress}% spent</span>
                    <span style={captionDimStyle}>of {fmt(planned!)} MAD planned</span>
                  </>
                ) : (
                  <span style={captionStyle}>No plan yet</span>
                )}
              </div>
            </div>
          );
        })()}

      </div>

    </section>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 36,
  padding: "16px 24px 24px",
  borderRadius: 24,
};

const pillRailStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const activePillStyle = (scope: BudgetScope): CSSProperties => ({
  height: 38,
  borderRadius: 12,
  border: "none",
  background: SCOPE_BG[scope],
  color: SCOPE_INK[scope],
  padding: "0 14px 0 10px",
  gap: 7,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  transition: "transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
  animation: "categorySelectIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
  position: "relative",
});

const activeLabelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const inactivePillStyle = (scope: BudgetScope): CSSProperties => ({
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
  background: "transparent",
  color: getScopeColor(scope),
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
  position: "relative",
});

const heroStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  animation: "fadeUp 0.22s ease both",
};

const numberGroupStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const statusStyle = (status: string): CSSProperties => ({
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: STATUS_COLOR[status] ?? "var(--muted)",
});

const amountRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 7,
};

const bigNumberStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: "clamp(56px, 15vw, 88px)",
  fontWeight: 400,
  lineHeight: 0.88,
  letterSpacing: "-0.022em",
  color: isOver ? "var(--danger)" : "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
});

const unitStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: "clamp(12px, 2.8vw, 15px)",
  fontWeight: 400,
  letterSpacing: "0.01em",
  color: isOver ? "color-mix(in srgb, var(--danger) 70%, var(--muted))" : "var(--muted)",
  lineHeight: 1,
});

const curveGroupStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const captionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: 6,
};

const captionStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text2)",
};

const captionDimStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: "0.02em",
  color: "var(--muted)",
};



