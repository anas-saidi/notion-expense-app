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



const STATUS_COLOR: Record<string, string> = {
  "On track":  "var(--accent)",
  "Together":  "var(--accent)",
  "Low":       "var(--warning)",
  "Over":      "var(--danger)",
  "No plan":   "var(--muted)",
  "Quiet":     "var(--muted)",
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
  balance:  "var(--text)",
  budgeted: "color-mix(in srgb, var(--text) 80%, #a8d8ff)",  // cool blue tint
  spent:    "color-mix(in srgb, var(--text) 80%, #ffd6a5)",  // warm amber tint
};
const JOINT_VIEW_DOT_ACTIVE = "color-mix(in srgb, var(--text) 70%, transparent)";
const JOINT_VIEW_DOT_INACTIVE = "color-mix(in srgb, var(--text) 20%, transparent)";

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, leftToSpendByScope, balanceByScope, contribStatus }: WalletCardSwitcherProps) {
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
      style={wrapStyle}
      aria-label="Wallet overview"
    >

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
                <div key={v} style={jointDotStyle(v === jointView)} />
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
            : "var(--accent)";
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

        {/* Joint contribution — inline within the card */}
        {value === "joint" && contribStatus && (contribStatus.anasPlan > 0 || contribStatus.salmaPlan > 0) && (
          <div style={contribSectionStyle}>
            <ContribRow name="Anas" actual={contribStatus.anasActual} plan={contribStatus.anasPlan} color="var(--partner-husband)" />
            <ContribRow name="Salma" actual={contribStatus.salmaActual} plan={contribStatus.salmaPlan} color="var(--partner-wife)" />
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
  color: isOver ? "var(--danger)" : "var(--text)",
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

function ContribRow({ name, actual, plan, color }: {
  name: string; actual: number; plan: number; color: string;
}) {
  const left = Math.max(0, plan - actual);
  const done = plan > 0 && actual >= plan * 0.99;
  const pct = plan > 0 ? Math.min(100, (actual / plan) * 100) : 0;

  return (
    <div style={contribRowStyle}>
      <div style={contribHeaderStyle}>
        <span style={{ ...contribNameStyle, color }}>{name}</span>
        <span style={contribValueStyle}>
          {done
            ? <span style={{ color: "var(--accent)", fontWeight: 600 }}>Done</span>
            : <><span style={{ fontWeight: 600, color: "var(--text2)" }}>{fmt(Math.round(left))}</span> left</>
          }
        </span>
      </div>
      <div style={contribBarRailStyle}>
        <div style={{
          ...contribBarFillStyle,
          width: `${pct}%`,
          background: done ? "var(--accent)" : color,
        }} />
      </div>
    </div>
  );
}

const contribSectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const contribRowStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const contribHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
};

const contribNameStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const contribBarRailStyle: CSSProperties = {
  height: 4,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const contribBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
};

const contribValueStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const jointDotStyle = (active: boolean): CSSProperties => ({
  width: active ? 14 : 4,
  height: 4,
  borderRadius: 999,
  background: active ? JOINT_VIEW_DOT_ACTIVE : JOINT_VIEW_DOT_INACTIVE,
  transition: "width 0.25s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease",
  flexShrink: 0,
});
