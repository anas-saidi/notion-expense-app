import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { Money } from "./Money";
import { ScreenHero } from "./ui/ScreenHero";
import { fmt } from "./app-utils";
import { contributionDue } from "./contribution-utils";
import { MascotHero, MASCOT_HERO_SIZE, type JarSignal } from "./mascot/MascotHero";
import { useOnline } from "./useOnline";
import { monthProgress, pace } from "./category-status";
import { MascotSpill } from "./mascot/MascotSpill";
import { PartnerTap } from "./mascot/PartnerTap";
import { topSpentJarItems } from "./mascot/budgetJar";
import { GrainGlow } from "./grain/GrainGlow";
import { contributionMood, spendingMood } from "./light-mood";
import { PALETTES } from "./grain/palettes";

export type ContribStatus = ContributionStatus;

type WalletCardSwitcherProps = {
  value: BudgetScope;
  /** Who is signed in: in Couple the hero number is what they still have to contribute. */
  personalScope?: Exclude<BudgetScope, "joint">;
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
  /** Bumped on each save: the jar winks once. */
  winkId?: number;
  /** Couple: tapping a partner's jar opens their contributions. */
  onOpenPartner?: (partner: "anas" | "salma") => void;
  /** A one-off on the jar, e.g. a comet when money moved. */
  once?: { kind: "comet" | "burst"; id: number } | null;
  /** Balances couldn't refresh: the jar becomes "!" and tapping it retries (the reason is also in the banner). */
  stale?: { reason: string; onRetry: () => void } | null;
};

const HOME_POOL_SIZE = MASCOT_HERO_SIZE;
/** Where a jar sits while its level is loading, on a device that hasn't shown it before. */
const PENDING_LEVEL = 0.5;
export function WalletCardSwitcher({ value, personalScope = "anas", monthlySummary, monthlyLoading = false, monthlyError = false, categoryAvailableByScope, balanceByScope, contribStatus, categories = [], overspent: overspentProp = 0, balanceDetail, summary, feedback, winkId, once, stale, onOpenPartner }: WalletCardSwitcherProps) {
  const online = useOnline();
  // One signal per jar, by priority: "!" when balances are stale, a sleeping dot offline.
  const signal: JarSignal | null = stale ? { kind: "alert", label: `${stale.reason}. Retry`, onTap: stale.onRetry }
    : !online ? { kind: "sleep", label: "Offline, showing the last figures", caption: true } : null;
  const currentSummary = monthlySummary;
  // Cash in the scope's accounts: not the hero number any more; Home's summary states it on a calm day.
  const balance   = balanceByScope != null ? balanceByScope[value] : null;
  const available = categoryAvailableByScope != null ? categoryAvailableByScope[value] : null;
  const planned   = currentSummary?.totalAssigned ?? null;
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
  // The light is the mood of the hero number (design.md, Light). Personal: Left to spend against
  // the calendar (steady on pace, brighter ahead, dimmer behind, coral overspent).
  const progress  = currentSummary?.start ? monthProgress(currentSummary.start.slice(0, 7)) : 0.5;
  const mood      = !isJoint && available != null && !monthlyLoading && !monthlyError ? spendingMood(available, spent, progress) : null;
  const poolLevel = mood?.level ?? 1 - spent / (planned ?? 1);
  const poolWarn  = mood ? mood.warn : poolPace === "good" ? null : poolPace;

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
    return { partner, plan, due, paid, label, level: contributionMood(paid, plan).level };
  }) : null;
  const spentSummary = `${Math.round(Math.max(0, Math.min(100, 100 - (spentPct ?? 0))))}% of the monthly budget remaining` + (overspent > 0 ? `, ${fmt(overspent)} MAD overspent` : "");
  // The jar shows with the balance, before the monthly figures arrive: it holds the
  // level it last showed on this device (or a neutral one the first time), then
  // moves to the real level and becomes tappable once they're in.
  const pending = monthlyLoading;
  // Couple: each jar is its own button and tells only its own figure.
  const couplePool = isJoint && (pending || contribution) && (
    <MascotHero
      look="light" variant="pool" size={HOME_POOL_SIZE} scope={value} spentPct={spentPct} balance={balance} available={available ?? 0}
      pending={pending}
      level={pending ? PENDING_LEVEL : 1 - spent / (planned ?? 1)} warn={overspent > 0 ? "over" : null}
      levels={contribution && !pending ? { anas: contribution[0].level, salma: contribution[1].level } : { anas: PENDING_LEVEL, salma: PENDING_LEVEL }}
      signal={signal} winkId={winkId} once={once}
      wrapJar={(partner, jar, jarSize) => {
        const c = pending ? undefined : contribution?.find(entry => entry.partner === partner);
        const label = c?.label ?? `${partner === "anas" ? "Anas" : "Salma"}: loading contribution`;
        // The jar (and its due dot) opens that partner's contributions, like the "due" in the sentence below.
        return <PartnerTap size={jarSize} pending={!c} open={false} onToggle={() => onOpenPartner?.(partner)} label={`${label}. Open contributions`}>{jar}</PartnerTap>;
      }}
    />
  );
  // Stale: the "!" is the jar's only button (no details to spill until the figures are fresh).
  const stalePool = !couplePool && stale && (pending || hasPlan) && (
    <MascotHero look="light" variant="pool" size={HOME_POOL_SIZE} scope={value} pending={pending} level={pending ? PENDING_LEVEL : poolLevel} warn={poolWarn} spentPct={spentPct} balance={balance} available={available ?? 0} signal={signal} />
  );
  const pool = couplePool || stalePool || (pending || hasPlan) && (
    <MascotSpill
      size={HOME_POOL_SIZE}
      pending={pending}
      hintKey="mascot-spill-hint"
      label={pending ? "Loading monthly details" : `This month: ${spentSummary} (${fmt(spent)} MAD spent of ${fmt(planned ?? 0)} MAD planned)${topSpentLabel}`}
      onOpenChange={setPoolOpen}
      details={<>
        {Math.round(Math.max(0, Math.min(100, 100 - (spentPct ?? 0))))}% budget left
        {overspent > 0 && <span style={{ color: "var(--danger)", display: "block" }}><Money value={overspent} /> overspent</span>}
      </>}
    >
      <MascotHero look="light" variant="pool" size={HOME_POOL_SIZE} items={poolOpen && !pending ? topSpent : undefined} scope={value} pending={pending} level={pending ? PENDING_LEVEL : poolLevel} warn={poolWarn} spentPct={spentPct} balance={balance} available={available ?? 0} signal={signal} winkId={winkId} once={once} />
    </MascotSpill>
  );

  // The room is as bright as the pool is full; dim (but present) while loading or without a plan.
  // Couple: the room follows the least-funded partner, as the heart does (full only when both are in).
  const roomLevel = pending ? 0.35
    : isJoint ? contribution ? Math.min(contribution[0].level, contribution[1].level) : 0.35
    : mood?.level ?? (hasPlan ? Math.max(0, Math.min(1, 1 - spent / (planned ?? 1))) : 0.35);
  // Hero number: what this screen asks of you. Personal: Left to spend (spending categories'
  // Available, carry-over included, savings excluded). Couple: what you still have to contribute.
  const myDue = isJoint && contribStatus ? Math.round(contributionDue(contribStatus, personalScope)) : null;
  const heroLabel = isJoint ? "To contribute" : "Left to spend";
  const heroValue = isJoint ? myDue : available != null ? Math.round(available) : null;
  const heroDone = isJoint && myDue != null && myDue <= 0 ? "All contributed" : undefined;

  return (
    <div style={switcherStyle}>
      {/* The room: the jar's light fills the hero, its strength following what's left of the plan (design.md, Light). */}
      <section className="wallet-overview-card grain-stage" aria-label="Wallet overview">
        <GrainGlow direction="room" scope={value} level={roomLevel} tones={PALETTES.partner} />
        <ScreenHero
          mascot={monthlyError
            ? <span role="status" style={captionStyle}>Monthly details unavailable</span>
            : pool || <span style={captionStyle}>No monthly plan</span>}
          label={heroLabel}
          value={heroValue}
          done={heroDone}
          loading={monthlyLoading && heroValue == null}
          tone={heroValue != null && heroValue < 0 ? "danger" : undefined}
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
