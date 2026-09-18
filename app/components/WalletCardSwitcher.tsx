import { useEffect, useState, type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { fmt } from "./app-utils";
import { HeartIcon } from "./ui/icons";
import { AnimatedCounter } from "./ui/AnimatedCounter";

export type ContribStatus = ContributionStatus;

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  leftToSpendByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  contribStatus?: ContribStatus | null;
  partnerAvatars?: Partial<Record<"anas" | "salma", string>>;
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

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, leftToSpendByScope, balanceByScope, contribStatus, partnerAvatars, onOpenJointAllocate }: WalletCardSwitcherProps) {
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
  const anasDifference = contribStatus ? contribStatus.anasActual - contribStatus.anasPlan : 0;
  const salmaDifference = contribStatus ? contribStatus.salmaActual - contribStatus.salmaPlan : 0;
  const fundingGap = contribStatus
    ? Math.max(0, contribStatus.partnerRequirement - contribStatus.anasActual - contribStatus.salmaActual)
    : 0;
  const contributionSummary = anasDifference > 0.5 && salmaDifference > 0.5
    ? "Joined owes partners " + fmt(Math.round(anasDifference + salmaDifference)) + " MAD"
    : anasDifference > 0.5
      ? "Joined owes Anas " + fmt(Math.round(anasDifference)) + " MAD"
      : salmaDifference > 0.5
        ? "Joined owes Salma " + fmt(Math.round(salmaDifference)) + " MAD"
        : fundingGap > 0.5
          ? fmt(Math.round(fundingGap)) + " MAD funding gap"
          : "Contributions settled";

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
          const barColor = progress >= 100
            ? "var(--spend-over)"
            : progress >= 85
              ? "var(--spend-caution-deep)"
              : progress >= 70
                ? "var(--spend-caution)"
                : "var(--accent-foreground)";
          const progressStatus = isBudgetOver
            ? fmt(spent - (planned || 0)) + " MAD over budget"
            : progress >= 100
              ? "Plan fully used"
              : progress >= 85
                ? "Budget nearly used"
                : progress >= 70
                  ? "Spending is getting close"
                  : "On track";
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
                aria-valuetext={hasPlan ? progress + "% spent, " + fmt(remaining) + " MAD left, " + progressStatus : "No monthly plan"}
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
                  <span style={captionStyle}>{progress}% used · {progressStatus}</span>
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
              avatarUrl={partnerAvatars?.anas}
              onSelect={onChange}
            />
            <span style={contribSharedStyle}>
              <span className="contribution-heart" style={contribConnectorStyle} aria-hidden="true"><HeartIcon size={24} strokeWidth={2} fill="currentColor" /></span>
              <span style={contribGapStyle}>
                {contributionSummary}
              </span>
            </span>
            <ContribCard
              scope="salma"
              name="Salma"
              actual={contribStatus.salmaActual}
              plan={contribStatus.salmaPlan}
              color="var(--partner-wife)"
              avatarUrl={partnerAvatars?.salma}
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
  transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
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

function ContribCard({ scope, name, actual, plan, color, avatarUrl, onSelect }: {
  scope: BudgetScope;
  name: string;
  actual: number;
  plan: number;
  color: string;
  avatarUrl?: string;
  onSelect: (scope: BudgetScope) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const difference = actual - plan;
  const due = Math.max(0, -difference);
  const overpaid = Math.max(0, difference);
  const pct = plan > 0 ? Math.min(100, (actual / plan) * 100) : 0;
  const statusText = due > 0.5
    ? fmt(Math.round(due)) + " MAD due"
    : overpaid > 0.5
      ? fmt(Math.round(overpaid)) + " MAD overpaid"
      : "Settled";

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
            {avatarUrl && !imageFailed ? (
              <img src={avatarUrl} alt="" onError={() => setImageFailed(true)} style={contribAvatarImageStyle} />
            ) : (
              <PartnerPortrait partner={scope === "anas" ? "anas" : "salma"} />
            )}
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
  const isAnas = partner === "anas";
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <circle cx="21" cy="21" r="18" fill="currentColor" opacity=".12" />
      {isAnas ? (
        <>
          <path d="M11.5 18.5c.4-7.2 4.2-11 10-11 5.1 0 8.4 2.7 9.3 7.7-2.7-1.9-5.8-2.7-9.1-2.1-4.4.8-6.7 3.2-10.2 5.4Z" fill="currentColor" opacity=".72" />
          <path d="M12.5 18.2c0 9.4 3.6 15.2 8.8 15.2s8.8-5.8 8.8-15.2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14.2 29c1.9 4.7 12.1 4.7 14.1 0-1.6 5-4 7-7.1 7s-5.4-2-7-7Z" fill="currentColor" opacity=".3" />
        </>
      ) : (
        <>
          <path d="M8.5 21.2C8.5 11.8 13.2 6 21 6s12.5 5.8 12.5 15.2c0 6.7-2.7 11.7-6.2 15l-1.5-9.6h-9.6l-1.5 9.6c-3.5-3.3-6.2-8.3-6.2-15Z" fill="currentColor" opacity=".7" />
          <path d="M12.5 18.5c0 9.2 3.5 14.8 8.5 14.8s8.5-5.6 8.5-14.8c-4.9-.4-8.7-2.2-11.5-5.5-1 2.6-2.8 4.5-5.5 5.5Z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </>
      )}
      <path d="M16.7 21.4h.1M25.2 21.4h.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="15.2" cy="25.2" r="1.8" fill="currentColor" opacity=".16" />
      <circle cx="26.8" cy="25.2" r="1.8" fill="currentColor" opacity=".16" />
      <path d="M17.5 26.6c1.8 2.1 5.2 2.1 7 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
const contribConnectorStyle: CSSProperties = { width: 36, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--partner-wife)" };

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

const contribAvatarImageStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" };

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
