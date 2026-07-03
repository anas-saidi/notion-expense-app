import { useEffect, useState, type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { fmt } from "./app-utils";

export type ContribStatus = {
  anasPlan: number; salmaPlan: number;
  anasActual: number; salmaActual: number;
};

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  leftToSpendByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  contribStatus?: ContribStatus | null;
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


type JointView = "balance" | "budgeted" | "spent";
const JOINT_VIEWS: JointView[] = ["balance", "budgeted", "spent"];
const JOINT_VIEW_LABEL: Record<JointView, string> = {
  balance:  "balance",
  budgeted: "budgeted",
  spent:    "spent",
};
// Each view gets its own accent so the number feels distinct at a glance
const JOINT_VIEW_COLOR: Record<JointView, string> = {
  balance:  "var(--accent-ink)",           // default — white/ink on green
  budgeted: "color-mix(in srgb, var(--accent-ink) 80%, #a8d8ff)",  // cool blue tint
  spent:    "color-mix(in srgb, var(--accent-ink) 80%, #ffd6a5)",  // warm amber tint
};
const JOINT_VIEW_DOT: Record<JointView, string> = {
  balance:  "color-mix(in srgb, var(--accent-ink) 70%, transparent)",
  budgeted: "color-mix(in srgb, #a8d8ff 90%, var(--accent-ink))",
  spent:    "color-mix(in srgb, #ffd6a5 90%, var(--accent-ink))",
};

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, leftToSpendByScope, balanceByScope, contribStatus }: WalletCardSwitcherProps) {
  const [hovered, setHovered]   = useState<BudgetScope | null>(null);
  const [pressed, setPressed]   = useState<BudgetScope | null>(null);
  const [jointView, setJointView] = useState<JointView>("balance");

  // Reset cycling when switching scopes
  useEffect(() => { setJointView("balance"); }, [value]);

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

  const cycleJointView = () => {
    setJointView(v => {
      const idx = JOINT_VIEWS.indexOf(v);
      return JOINT_VIEWS[(idx + 1) % JOINT_VIEWS.length];
    });
  };

  // What to show in the hero number when joint
  const jointSummary = walletSummaries?.joint;
  const heroNumber = value === "joint"
    ? jointView === "budgeted" ? (planned ?? 0)
    : jointView === "spent"    ? (jointSummary?.totalSpent ?? 0)
    : Math.abs(balance ?? available ?? 0)
    : Math.abs(balance ?? available ?? 0);

  const heroUnit = value === "joint"
    ? (isOver && jointView === "balance") ? "over" : JOINT_VIEW_LABEL[jointView]
    : isOver ? "over" : "balance";

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

        {/* Status + number — tappable only on joint */}
        {value === "joint" ? (
          <button
            type="button"
            onClick={cycleJointView}
            style={numberGroupButtonStyle}
            aria-label={`Showing ${jointView}. Tap to cycle`}
          >
            <span style={statusStyle(status)}>{status}</span>
            <div style={amountRowStyle}>
              <span style={{ ...bigNumberStyle(isOver && jointView === "balance"), color: JOINT_VIEW_COLOR[jointView], transition: "color 0.3s ease" }}>
                {fmt(heroNumber)}
              </span>
              <span style={{ ...unitStyle(isOver && jointView === "balance"), color: `color-mix(in srgb, ${JOINT_VIEW_COLOR[jointView]} 60%, transparent)`, transition: "color 0.3s ease" }}>
                MAD {heroUnit}
              </span>
            </div>
            <div style={jointDotsStyle} aria-hidden="true">
              {JOINT_VIEWS.map(v => (
                <div key={v} style={jointDotStyle(v === jointView, JOINT_VIEW_DOT[v])} />
              ))}
            </div>
          </button>
        ) : (
          <div style={numberGroupStyle}>
            <span style={statusStyle(status)}>{status}</span>
            <div style={amountRowStyle}>
              <span style={bigNumberStyle(isOver)}>{fmt(Math.abs(balance ?? available ?? 0))}</span>
              <span style={unitStyle(isOver)}>MAD {isOver ? "over" : "balance"}</span>
            </div>
          </div>
        )}

        {/* Progress bar + caption */}
        {(() => {
          const barColor = isOver
            ? "var(--spend-over)"
            : progress >= 85 ? "var(--spend-warn)"
            : progress >= 65 ? "var(--spend-caution)"
            : getScopeColor(value);
          return (
            <div style={barGroupStyle}>
              <div style={{ position: "relative" }} aria-hidden="true">
                <div style={barRailStyle}>
                  <div
                    style={{
                      ...barFillStyle,
                      width: hasPlan ? `${progress}%` : "0%",
                      background: barColor,
                    }}
                  />
                </div>
                {hasPlan && progress > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${progress}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: 14,
                      lineHeight: 1,
                      transition: "left 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    💸
                  </span>
                )}
              </div>
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

        {/* Joint contribution status */}
        {value === "joint" && contribStatus && (contribStatus.anasPlan > 0 || contribStatus.salmaPlan > 0) && (
          <div style={contribRowStyle}>
            <ContribPill emoji="👨" actual={contribStatus.anasActual} plan={contribStatus.anasPlan} />
            <span style={{ opacity: 0.2, fontSize: 11 }}>·</span>
            <ContribPill emoji="👩" actual={contribStatus.salmaActual} plan={contribStatus.salmaPlan} />
          </div>
        )}

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

const barGroupStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const barRailStyle: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
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

/* Joint cycling */

const numberGroupButtonStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

const jointDotsStyle: CSSProperties = {
  display: "flex",
  gap: 5,
  paddingTop: 2,
};

function ContribPill({ emoji, actual, plan }: {
  emoji: string; actual: number; plan: number;
}) {
  const done = plan > 0 && actual >= plan * 0.99;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontVariantNumeric: "tabular-nums",
      color: "color-mix(in srgb, var(--accent-ink) 65%, transparent)",
    }}>
      <span style={{ fontSize: 12 }}>{emoji}</span>
      {done
        ? <span style={{ fontWeight: 700, color: "var(--accent-ink)" }}>Done</span>
        : <><span style={{ fontWeight: 600 }}>{fmt(Math.round(actual))}</span><span style={{ opacity: 0.5, fontWeight: 400 }}>/ {fmt(Math.round(plan))}</span></>
      }
    </span>
  );
}

const contribRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const jointDotStyle = (active: boolean, color: string): CSSProperties => ({
  width: active ? 14 : 4,
  height: 4,
  borderRadius: 999,
  background: active
    ? color
    : "color-mix(in srgb, var(--accent-ink) 20%, transparent)",
  transition: "width 0.25s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease",
  flexShrink: 0,
});
