import { useEffect, useState, type CSSProperties } from "react";
import type { BudgetScope, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { Money } from "./Money";
import { fmt } from "./app-utils";
import { HeartIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";
import { AnimatedCounter } from "./ui/AnimatedCounter";

export type ContribStatus = ContributionStatus;

type WalletCardSwitcherProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  monthlySummary?: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  categoryAvailableByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  contribStatus?: ContribStatus | null;
  partnerAvatars?: Partial<Record<"anas" | "salma", string>>;
  onOpenJointAllocate?: () => void;
};



type JointView = "balance" | "budgeted" | "spent";
const JOINT_VIEWS: JointView[] = ["balance", "budgeted", "spent"];
const JOINT_VIEW_LABEL: Record<JointView, string> = {
  balance:  "Joint balance",
  budgeted: "Planned this month",
  spent:    "Spent this month",
};
const JOINT_VIEW_DOT_ACTIVE = "color-mix(in srgb, var(--text) 70%, transparent)";
const JOINT_VIEW_DOT_INACTIVE = "color-mix(in srgb, var(--text) 20%, transparent)";

export function WalletCardSwitcher({ value, onChange, monthlySummary, walletSummaries, categoryAvailableByScope, balanceByScope, contribStatus, partnerAvatars, onOpenJointAllocate }: WalletCardSwitcherProps) {
  const { haptic } = useAppHaptics();
  const [jointView, setJointView] = useState<JointView>("balance");

  // Reset cycling when switching scopes
  useEffect(() => { setJointView("balance"); }, [value]);

  const currentSummary = monthlySummary ?? walletSummaries?.[value];
  // Hero number: real account balance by scope (from Notion accounts database)
  const balance   = balanceByScope != null ? balanceByScope[value] : null;
  // Current ledger snapshot is independent of the monthly summary.
  const available = categoryAvailableByScope != null ? categoryAvailableByScope[value] : null;
  const planned   = currentSummary?.totalAssigned ?? null;
  const isOver    = balance !== null && balance < 0;
  const hasPlan   = planned !== null && planned > 0;
  const spent     = currentSummary?.totalSpent ?? 0;
  const progress  = hasPlan ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
  const fundingGap = contribStatus?.fundingGap ?? 0;
  const contributionSummary = fundingGap > 0
    ? fmt(fundingGap) + " MAD to contribute"
    : "Fully funded";

  // What to show in the hero number when joint
  const jointSummary = walletSummaries?.joint;
  const heroNumber = value === "joint"
    ? jointView === "budgeted" ? (planned ?? 0)
    : jointView === "spent"    ? (jointSummary?.totalSpent ?? 0)
    : (balance ?? 0)
    : (balance ?? 0);

  const heroColor = isOver && jointView === "balance" ? "var(--danger)" : value === "joint" && jointView === "spent" ? "var(--danger)" : value === "joint" && jointView === "budgeted" ? "var(--accent-foreground)" : "var(--text)";
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
          {value !== "joint" && <span style={barContextStyle}>Account cash</span>}
          <div style={amountRowStyle} aria-label={value === "joint" ? JOINT_VIEW_LABEL[jointView] : "Account cash"}>
            <span style={{ ...bigNumberStyle(isOver && jointView === "balance"), color: heroColor }}><AnimatedCounter value={value === "joint" ? heroNumber : (balance ?? 0)} /></span>
            <span style={{ ...unitStyle(isOver && jointView === "balance"), color: heroColor, opacity: 0.65 }}>{heroUnit}</span>
          </div>
          {value === "joint" && (
            <div role="group" aria-label="Balance view" style={{ display: "flex", gap: 8 }}>
              {JOINT_VIEWS.map(view => (
                <button key={view} type="button" aria-pressed={view === jointView} onClick={() => { if (view !== jointView) haptic("selection"); setJointView(view); }} style={{ minHeight: 44, padding: "0 12px", border: 0, borderRadius: "var(--radius-control)", background: view === jointView ? "var(--surface2)" : "transparent", color: view === jointView ? "var(--text)" : "var(--muted)", fontWeight: view === jointView ? 700 : 500, cursor: "pointer" }}>
                  {view === "balance" ? "Balance" : view === "budgeted" ? "Planned" : "Spent"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={barGroupStyle}>
          <div style={barLabelRowStyle}>
            <span style={barContextStyle}>Category available</span>
            <span style={barValueStyle}>{available === null ? "Unavailable" : <Money value={available} />}</span>
          </div>
        </div>

        {/* Monthly activity is historical, separate from current availability. */}
        {(() => {
          const barColor = progress >= 100
            ? "var(--spend-over)"
            : progress >= 85
              ? "var(--spend-caution-deep)"
              : progress >= 70
                ? "var(--spend-caution)"
                : "var(--budget-used)";
          return (
            <div style={barGroupStyle}>
              {hasPlan && (
                <div style={barLabelRowStyle}>
                  <span style={barContextStyle}>This month</span>
                  <span style={barValueStyle}>{Math.round(spent / (planned ?? 1) * 100)}%</span>
                </div>
              )}
              <div
                style={{ position: "relative" }}
                role="progressbar"
                aria-label="Monthly budget spent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasPlan ? progress : 0}
                aria-valuetext={hasPlan ? Math.round(spent / planned * 100) + "% of assignments spent, " + fmt(spent) + " MAD spent against " + fmt(planned ?? 0) + " MAD allocated" : "No monthly plan"}
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
              {hasPlan ? (
                <div style={barLabelRowStyle}>
                  <span style={barValueStyle}><Money value={spent} /> spent</span>
                  <span style={barValueStyle}><Money value={planned ?? 0} /> allocated</span>
                </div>
              ) : <span style={captionStyle}>No monthly plan</span>}
            </div>
          );
        })()}

      </div>
      </section>

      {value === "joint" && !contribStatus && (
        <p style={contribUnavailableStyle} role="note">
          Contributions unavailable: set both partners' split percentages (totalling 100%) and check the joint balance and category balances.
        </p>
      )}

      {value === "joint" && contribStatus && (contribStatus.anasPlan > 0 || contribStatus.salmaPlan > 0 || available !== null) && (
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

const contribUnavailableStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--muted)", textAlign: "center" };

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
  const statusText = due > 0.005
    ? fmt(Math.round(due * 100) / 100) + " MAD due"
    : overpaid > 0.005
      ? fmt(Math.round(overpaid * 100) / 100) + " MAD above plan"
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
const contribGapStyle: CSSProperties = { maxWidth: 88, fontSize: 12, lineHeight: 1.4, color: "var(--text2)", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "center" };
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
  fontSize: 12,
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
