import { HeroSkeleton } from "./ui/Skeleton";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { Money } from "./Money";
import { ScreenHero } from "./ui/ScreenHero";
import { fmt } from "./app-utils";
import { MascotHero, MASCOT_HERO_SIZE } from "./mascot/MascotHero";
import { monthProgress, pace } from "./category-status";
import { MascotSpill } from "./mascot/MascotSpill";
import { topSpentJarItems } from "./mascot/budgetJar";

export type ContribStatus = ContributionStatus;

type WalletCardSwitcherProps = {
  value: BudgetScope;
  monthlySummary: MonthlySummary;
  monthlyLoading?: boolean;
  monthlyError?: boolean;
  categoryAvailableByScope?: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  contribStatus?: ContribStatus | null;
  /** For the pool's top spending categories, shown inside it when tapped. */
  categories?: Category[];
  /** Money spent beyond what categories had (Available below zero), this month only. */
  overspent?: number;
  /** Account obligations displayed directly beneath its balance. */
  balanceDetail?: ReactNode;
  summary?: ReactNode;
  feedback?: ReactNode;
};

const HOME_POOL_SIZE = MASCOT_HERO_SIZE;
export function WalletCardSwitcher({ value, monthlySummary, monthlyLoading = false, monthlyError = false, categoryAvailableByScope, balanceByScope, contribStatus, categories = [], overspent: overspentProp = 0, balanceDetail, summary, feedback }: WalletCardSwitcherProps) {
  const currentSummary = monthlySummary;
  // Hero number: real account balance by scope (from Notion accounts database)
  const balance   = balanceByScope != null ? balanceByScope[value] : null;
  const available = categoryAvailableByScope != null ? categoryAvailableByScope[value] : null;
  const planned   = currentSummary?.totalAssigned ?? null;
  const isOver    = balance !== null && balance < 0;
  const hasPlan   = !monthlyLoading && !monthlyError && planned !== null && planned > 0;
  const spent     = currentSummary?.totalSpent ?? 0;
  // "Over" means categories went below zero, not spending past this month's plan
  // (carry-over from earlier months can cover that).
  const overspent = Math.round(overspentProp);
  const spentPct  = hasPlan ? (spent / planned) * 100 : null;
  const isJoint   = value === "joint";
  // Draining on pace is the plan working; only spending faster than the month (or
  // past the plan) tints the pool, with the same rule as the category jars.
  const poolPace  = hasPlan && currentSummary?.start ? pace(1 - spent / planned, monthProgress(currentSummary.start.slice(0, 7))) : "good";
  const poolWarn  = poolPace === "good" ? null : poolPace;

  // Tapped, the pool also shows where the money went: the top three spending
  // categories drop in as emojis, sized by how much of the pool each took.
  const [poolOpen, setPoolOpen] = useState(false);
  const topSpent = useMemo(
    () => topSpentJarItems(currentSummary?.spentByCategory ?? [], categories, planned ?? 0),
    [currentSummary, categories, planned],
  );
  const topSpentLabel = topSpent.length ? `; most went to ${topSpent.map(i => i.name).join(", ")}` : "";

  // The pool is the hero: its level is what's left of this month's plan. The exact
  // numbers aren't needed at first glance, so they spill out when the jar is tapped.
  const spentSummary = `${Math.round(Math.max(0, Math.min(100, 100 - (spentPct ?? 0))))}% of the monthly budget remaining` + (overspent > 0 ? `, ${fmt(overspent)} MAD overspent` : "");
  const pool = hasPlan && (
    <MascotSpill
      size={HOME_POOL_SIZE}
     
      hintKey="mascot-spill-hint"
      label={`This month: ${spentSummary} (${fmt(spent)} MAD spent of ${fmt(planned ?? 0)} MAD planned)${topSpentLabel}`}
      onOpenChange={setPoolOpen}
      details={<>
        {Math.round(Math.max(0, Math.min(100, 100 - (spentPct ?? 0))))}% budget left
        {overspent > 0 && <span style={{ color: "var(--danger)", display: "block" }}><Money value={overspent} /> overspent</span>}
      </>}
    >
      <MascotHero variant="pool" size={HOME_POOL_SIZE} items={poolOpen ? topSpent : undefined} scope={value} level={1 - spent / (planned ?? 1)} warn={poolWarn} spentPct={spentPct} balance={balance} available={available ?? 0} />
    </MascotSpill>
  );

  return (
    <div style={switcherStyle}>
      <section className="wallet-overview-card" aria-label="Wallet overview">
        <ScreenHero
          mascot={monthlyLoading ? <HeroSkeleton size={HOME_POOL_SIZE} /> : monthlyError
            ? <span role="status" style={captionStyle}>Monthly details unavailable</span>
            : pool || <span style={captionStyle}>No monthly plan</span>}
          label="Balance"
          value={balance}
          tone={isOver ? "danger" : undefined}
          summary={summary}
          actions={<>{balanceDetail && <div className="wallet-balance-detail">{balanceDetail}</div>}{feedback}</>}
        />
      </section>

      {/* A contribution read error is already shown in Home's contributions slot. */}
      {!monthlyLoading && !monthlyError && !monthlySummary.contributionError && isJoint && !contribStatus && (
        <p style={contribUnavailableStyle} role="note">
          Contributions unavailable. Check both partners’ shares and Joint balances.
        </p>
      )}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const contribUnavailableStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--muted)", textAlign: "center" };

const switcherStyle: CSSProperties = { display: "grid", gap: 16 };

const captionStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text2)",
};
