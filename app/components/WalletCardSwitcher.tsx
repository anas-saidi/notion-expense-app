import { useEffect, useState, type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { fmt } from "./app-utils";
import { UsersRoundIcon } from "./ui/icons";
import { AnimatedCounter } from "./ui/AnimatedCounter";

export type ContribStatus = {
  anasPlan: number; salmaPlan: number;
  anasActual: number; salmaActual: number;
  anasDirectSpend: number; salmaDirectSpend: number;
  anasTransferred: number; salmaTransferred: number;
};

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  leftToSpendByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  contribStatus?: ContribStatus | null;
  onOpenJointAllocate?: () => void;
};



const STATUS_COLOR: Record<string, string> = {
  "On track":  "var(--accent-ink)",
  "Together":  "var(--accent-ink)",
  "Low":       "var(--warning)",
  "Over":      "var(--danger)",
  "No plan":   "var(--muted)",
  "Quiet":     "var(--muted)",
};

const STATUS_BACKGROUND: Record<string, string> = {
  "On track": "var(--accent-dim)",
  "Together": "var(--accent-dim)",
  "Low": "var(--warning-dim)",
  "Over": "color-mix(in srgb, var(--danger) 12%, var(--surface))",
  "No plan": "var(--surface2)",
  "Quiet": "var(--surface2)",
};


const getStatus = (available: number | null, planned: number | null, scope?: BudgetScope) => {
  if (planned === null || planned <= 0) return "No plan";
  if (available === null) return "Quiet";
  if (available < 0) return "Over";
  if (available / planned <= 0.18) return "Low";
  return scope === "joint" ? "Together" : "On track";
};

type JointView = "balance" | "budgeted" | "spent";
const JOINT_VIEWS: JointView[] = ["balance", "budgeted", "spent"];
const JOINT_VIEW_LABEL: Record<JointView, string> = {
  balance:  "Account balance",
  budgeted: "Planned this month",
  spent:    "Spent this month",
};
// Each view gets its own accent so the number feels distinct at a glance
const JOINT_VIEW_COLOR: Record<JointView, string> = {
  balance:  "var(--text)",
  budgeted: "color-mix(in srgb, var(--text) 80%, #a8d8ff)",  // cool blue tint
  spent:    "color-mix(in srgb, var(--text) 80%, #ffd6a5)",  // warm amber tint
};
const JOINT_VIEW_DOT_ACTIVE = "color-mix(in srgb, var(--text) 70%, transparent)";
const JOINT_VIEW_DOT_INACTIVE = "color-mix(in srgb, var(--text) 20%, transparent)";

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, leftToSpendByScope, balanceByScope, contribStatus, onOpenJointAllocate }: WalletCardSwitcherProps) {
  const [jointView, setJointView] = useState<JointView>("balance");

  // Reset cycling when switching scopes
  useEffect(() => { setJointView("balance"); }, [value]);

  const currentSummary = monthlySummary ?? walletSummaries?.[value];
  // Hero number: real account balance by scope (from Notion accounts database)
  const balance   = balanceByScope != null ? balanceByScope[value] : null;
  // Curve/progress still uses category-based left-to-spend for spend % display
  const available = leftToSpendByScope != null ? leftToSpendByScope[value] : currentSummary ? currentSummary.totalAssigned - currentSummary.totalSpent : null;
  const planned   = currentSummary?.totalAssigned ?? null;
  const status    = getStatus(balance, planned, value);
  const isOver    = balance !== null && balance < 0;
  const hasPlan   = planned !== null && planned > 0;
  const spent     = Math.max(0, currentSummary?.totalSpent ?? (planned ?? 0) - (available ?? 0));
  const remaining = Math.max(0, (planned ?? 0) - spent);
  const progress  = hasPlan ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
  const isBudgetOver = hasPlan && spent > planned;
  const contributionRemaining = contribStatus
    ? Math.max(0, contribStatus.anasPlan + contribStatus.salmaPlan - contribStatus.anasActual - contribStatus.salmaActual)
    : 0;

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
    : (balance ?? available ?? 0)
    : (balance ?? available ?? 0);

  const heroUnit = "MAD";
  return (
    <div style={switcherStyle}>
      <section
        className="wallet-overview-card"
        style={wrapStyle}
        aria-label="Wallet overview"
      >

      {/* Hero */}
      <div style={heroStyle} key={value}>

        <div style={numberGroupStyle}>
          <div style={amountRowStyle}>
            <span style={bigNumberStyle(isOver && jointView === "balance")}><AnimatedCounter value={value === "joint" ? heroNumber : (balance ?? available ?? 0)} animateOnMount /></span>
            <span style={unitStyle(isOver && jointView === "balance")}>{heroUnit}</span>
          </div>
          {value === "joint" && (
            <div role="group" aria-label="Balance view" style={{ display: "flex", gap: 8 }}>
              {JOINT_VIEWS.map(view => (
                <button key={view} type="button" aria-pressed={view === jointView} onClick={() => setJointView(view)} style={{ minHeight: 44, padding: "0 12px", border: 0, borderRadius: "var(--radius-control)", background: view === jointView ? "var(--surface2)" : "transparent", color: view === jointView ? "var(--text)" : "var(--muted)", fontWeight: view === jointView ? 700 : 500, cursor: "pointer" }}>
                  {view === "balance" ? "Balance" : view === "budgeted" ? "Planned" : "Spent"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar + caption */}
        {(() => {
          const barColor = isBudgetOver
            ? "var(--spend-over)"
            : progress >= 85 ? "var(--spend-caution)"
            : "var(--budget-used)";
          return (
            <div style={barGroupStyle}>
              {hasPlan && (
                <div style={barLabelRowStyle}>
                  <span style={barContextStyle}>Monthly plan</span>
                  <span style={barValueStyle}>{fmt(remaining)} MAD left</span>
                </div>
              )}
              <div
                style={{ position: "relative" }}
                role="progressbar"
                aria-label="Monthly budget spent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasPlan ? progress : 0}
                aria-valuetext={hasPlan ? `${progress}% spent, ${fmt(remaining)} MAD left` : "No monthly plan"}
              >
                <div style={barRailStyle}>
                  <div
                    style={{
                      ...barFillStyle,
                      transform: `scaleX(${hasPlan ? progress / 100 : 0})`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
              <div style={captionRowStyle}>
                {hasPlan ? (
                  <span style={captionStyle}>{progress}% used{isBudgetOver ? ` · ${fmt(spent - (planned ?? 0))} MAD over budget` : progress >= 85 ? " · Budget nearly used" : ""}</span>
                ) : (
                  <span style={captionStyle}>No monthly plan</span>
                )}
              </div>
            </div>
          );
        })()}

      </div>
      </section>

      {value === "joint" && contribStatus && (contribStatus.anasPlan > 0 || contribStatus.salmaPlan > 0) && (
        <div style={contribSectionStyle} aria-label="Partner budgets">
          <div style={contribHeaderStyle}>
            <strong style={contribHeadingStyle}>Contributions</strong>
          </div>
          <div style={contribPanelStyle}>
            <div style={contribGridStyle}>
            <ContribCard
              scope="anas"
              name="Anas"
              actual={contribStatus.anasActual}
              plan={contribStatus.anasPlan}
              color="var(--partner-husband)"
              onSelect={onChange}
            />
            <span style={contribSharedStyle}>
              <span style={contribConnectorStyle} aria-hidden="true"><UsersRoundIcon size={15} /></span>
              <span style={contribGapStyle}>
                {contributionRemaining > 0 ? `${fmt(Math.round(contributionRemaining))} MAD remaining` : "Covered together"}
              </span>
            </span>
            <ContribCard
              scope="salma"
              name="Salma"
              actual={contribStatus.salmaActual}
              plan={contribStatus.salmaPlan}
              color="var(--partner-wife)"
              onSelect={onChange}
            />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const switcherStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const wrapStyle: CSSProperties = {
  display: "grid",
  padding: "20px 0 12px",
  background: "transparent",
  boxShadow: "none",
};

const heroStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  animation: "fadeUp 0.22s ease both",
};

const numberGroupStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  justifyItems: "center",
  textAlign: "center",
};

const statusStyle = (status: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "3px 8px",
  borderRadius: 8,
  background: STATUS_BACKGROUND[status] ?? "var(--surface2)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  color: STATUS_COLOR[status] ?? "var(--muted)",
});

const amountRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: 8,
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

const barLabelRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
};

const barValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const barContextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
};

const barRailStyle: CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 999,
  transformOrigin: "left center",
  transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
};

const captionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 6,
};

const captionStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text2)",
};

/* Joint cycling */

const numberGroupButtonStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  width: "100%",
  justifyItems: "center",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "center",
};

const jointDotsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 4,
  paddingTop: 4,
};

function ContribCard({ scope, name, actual, plan, color, onSelect }: {
  scope: BudgetScope;
  name: string;
  actual: number;
  plan: number;
  color: string;
  onSelect: (scope: BudgetScope) => void;
}) {
  const difference = actual - plan;
  const left = Math.max(0, -difference);
  const done = plan > 0 && actual >= plan * 0.99;
  const pct = plan > 0 ? Math.min(100, (actual / plan) * 100) : 0;
  const statusText = done
    ? `${fmt(Math.round(actual))} MAD covered`
    : `${fmt(Math.round(left))} MAD left`;

  return (
    <button
      type="button"
      className="partner-summary-card"
      style={contribCardStyle}
      onClick={() => onSelect(scope)}
      aria-label={`Open ${name} contribution. ${statusText}.`}
    >
      <span style={contribRingStyle(pct, color)} aria-hidden="true">
          <span style={{ ...contribAvatarStyle, background: `color-mix(in srgb, ${color} 24%, var(--surface))`, color }}>
            <PartnerPortrait partner={scope === "anas" ? "anas" : "salma"} />
          </span>
      </span>
      <span style={contribIdentityStyle}>
        <span style={contribNameStyle}>{name}</span>
        <span style={contribAmountStyle}>{statusText}</span>
      </span>
    </button>
  );
}

function PartnerPortrait({ partner }: { partner: "anas" | "salma" }) {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      {partner === "anas" ? (
        <>
          <path d="M11 17c1-7 6-11 12-11 5 0 9 2 11 7-3-2-6-3-10-2-5 1-8 4-13 6Z" fill="currentColor" opacity=".2" />
          <path d="M12 18c0 10 4 16 10 16s10-6 10-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 17c2-1 4-4 5-7m17 7c-1-3-3-6-6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 21h.1M27 21h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 27c2 2 6 2 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M8 21C8 11 13 5 21 5s13 6 13 16c0 7-3 12-6 15l-2-9H16l-2 9c-3-3-6-8-6-15Z" fill="currentColor" opacity=".2" />
          <path d="M12 19c0 9 4 15 9 15s9-6 9-15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 18c3-1 5-4 6-8 3 4 7 6 13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16.5 21h.1M25.5 21h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M17 27c2 2 6 2 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const contribSectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const contribHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12,
};

const contribHeadingStyle: CSSProperties = { fontSize: 14, color: "var(--text)" };
const contribPanelStyle: CSSProperties = { display: "grid", padding: "8px 10px 6px", background: "transparent" };
const contribSharedStyle: CSSProperties = { display: "grid", justifyItems: "center", alignContent: "start", gap: 7, paddingTop: 17 };
const contribGapStyle: CSSProperties = { maxWidth: 88, fontSize: 10, lineHeight: 1.25, color: "var(--text2)", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "center" };
const contribGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "104px 88px 104px", justifyContent: "center", alignItems: "start", gap: 0 };
const contribConnectorStyle: CSSProperties = { width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--text)", color: "var(--bg)", boxShadow: "var(--elevation-card)" };

const contribCardStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 6,
  minWidth: 0,
  minHeight: 98,
  padding: "2px",
  border: "none",
  borderRadius: 14,
  background: "transparent",
  boxShadow: "none",
  color: "var(--text)",
  textAlign: "center",
  cursor: "pointer",
};

const contribIdentityStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 4,
};

const contribAvatarStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 54,
  height: 54,
  borderRadius: "50%",
  flexShrink: 0,
};

const contribRingStyle = (pct: number, color: string): CSSProperties => ({
  width: 68,
  height: 68,
  padding: 4,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: `conic-gradient(${color} ${pct}%, color-mix(in srgb, ${color} 13%, var(--surface)) ${pct}% 100%)`,
  flexShrink: 0,
});

const contribNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.2,
};

const contribAmountStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const jointDotStyle = (active: boolean): CSSProperties => ({
  width: 14,
  height: 4,
  borderRadius: 999,
  background: active ? JOINT_VIEW_DOT_ACTIVE : JOINT_VIEW_DOT_INACTIVE,
  transform: `scaleX(${active ? 1 : 0.285})`,
  transformOrigin: "left center",
  transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease",
  flexShrink: 0,
});
