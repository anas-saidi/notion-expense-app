import { HeroSkeleton } from "./ui/Skeleton";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { Money } from "./Money";
import { ScreenHero } from "./ui/ScreenHero";
import { fmt } from "./app-utils";
import { contributionDue } from "./contribution-utils";
import { MascotHero, MASCOT_HERO_SIZE } from "./mascot/MascotHero";
import { monthProgress, pace } from "./category-status";
import { MascotSpill } from "./mascot/MascotSpill";
import { PartnerTap } from "./mascot/PartnerTap";
import { LABEL_GLYPH } from "./mascot/Mascot";
import type { JarItem } from "./mascot/coinSimMatter";
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
  // Couple: each partner's jar fills by how much of their agreed contribution is in,
  // so what's still due reads at a glance. Without a contribution status the pair
  // falls back to one shared waterline (budget left), like a personal jar.
  const contribution = isJoint && contribStatus ? (["anas", "salma"] as const).map(partner => {
    const plan = partner === "anas" ? contribStatus.anasPlan : contribStatus.salmaPlan;
    const due = contributionDue(contribStatus, partner);
    const actual = partner === "anas" ? contribStatus.anasActual : contribStatus.salmaActual;
    const paid = Math.max(0, plan - due);
    const extra = Math.max(0, Math.round(actual - plan));
    const name = partner === "anas" ? "Anas" : "Salma";
    const label = due > 0.5 ? `${name} has ${fmt(Math.round(due))} MAD left to contribute (${fmt(Math.round(paid))} of ${fmt(Math.round(plan))})`
      : extra > 0 ? `${name} contributed in full, ${fmt(extra)} MAD extra` : `${name} contributed in full`;
    // Tapped, the figure drops into the jar as a token and settles like the spending art does.
    const token: JarItem = {
      id: `contribution:${partner}`,
      glyph: `${LABEL_GLYPH}${due > 0.5 ? `${fmt(Math.round(due))}|left|danger` : extra > 0 ? `+${fmt(extra)}|extra|success` : "Paid||success"}`,
      radius: 0.3,
    };
    return { partner, plan, due, paid, label, token, level: plan > 0 ? Math.min(1, paid / plan) : 1 };
  }) : null;
  const [openPartner, setOpenPartner] = useState<"anas" | "salma" | null>(null);
  const spentSummary = `${Math.round(Math.max(0, Math.min(100, 100 - (spentPct ?? 0))))}% of the monthly budget remaining` + (overspent > 0 ? `, ${fmt(overspent)} MAD overspent` : "");
  // Couple: each jar is its own button and tells only its own figure.
  const couplePool = contribution && (
    <MascotHero
      variant="pool" size={HOME_POOL_SIZE} scope={value} spentPct={spentPct} balance={balance} available={available ?? 0}
      level={1 - spent / (planned ?? 1)} warn={null}
      levels={{ anas: contribution[0].level, salma: contribution[1].level }}
      pairItems={openPartner ? { [openPartner]: [contribution.find(entry => entry.partner === openPartner)!.token] } : undefined}
      wrapJar={(partner, jar, jarSize) => {
        const c = contribution.find(entry => entry.partner === partner)!;
        return <PartnerTap size={jarSize} open={openPartner === partner} onToggle={() => setOpenPartner(open => open === partner ? null : partner)} label={c.label}>{jar}</PartnerTap>;
      }}
    />
  );
  const pool = couplePool || hasPlan && (
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
          Contributions unavailable. Check both partners’ shares and the Joined balance.
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
