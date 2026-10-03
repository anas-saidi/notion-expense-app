import { HeroSkeleton } from "./ui/Skeleton";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { Currency, Money } from "./Money";
import { fmt } from "./app-utils";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { MascotHero, MASCOT_HERO_SIZE } from "./mascot/MascotHero";
import { monthProgress, pace } from "./category-status";
import { Mascot } from "./mascot/Mascot";
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
};

const HOME_POOL_SIZE = MASCOT_HERO_SIZE;
/** Side mascots on Joint Home: small, cuddled up against the joint pool. */
const PARTNER_JAR_SIZE = 64;
/** A jar's visible bottom sits about 16% of its box above the box's bottom edge. */
const jarBottomGap = (size: number) => Math.round(size * 0.16);
/** Drop the partner jars so their bottoms rest level with the pool's. */
const CUDDLE_DROP = (HOME_POOL_SIZE - jarBottomGap(HOME_POOL_SIZE)) - (PARTNER_JAR_SIZE - jarBottomGap(PARTNER_JAR_SIZE));
/**
 * Pull them in across both jars' empty margins (the visible jar is about two
 * thirds of its box) so they just touch the pool's sides.
 */
const CUDDLE_PULL = Math.round(HOME_POOL_SIZE / 6) + Math.round(PARTNER_JAR_SIZE / 6);
/** Per-shape pull so each jar just touches the pool's curved side. */
const CUDDLE_PULL_EXTRA = { anas: 8, salma: 10 } as const;
/** How far each partner leans in (degrees): a tipped squircle reads as falling, so Anas leans less. */
const CUDDLE_LEAN = { anas: 4, salma: 8 } as const;

export function WalletCardSwitcher({ value, monthlySummary, monthlyLoading = false, monthlyError = false, categoryAvailableByScope, balanceByScope, contribStatus, categories = [], overspent: overspentProp = 0 }: WalletCardSwitcherProps) {
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

  // The joint pool keeps an eye on whoever owes the most (Anas stands on the
  // left, Salma on the right); with nothing due it just watches its waterline.
  const anasDue  = contribStatus ? Math.max(0, contribStatus.anasPlan - contribStatus.anasActual) : 0;
  const salmaDue = contribStatus ? Math.max(0, contribStatus.salmaPlan - contribStatus.salmaActual) : 0;
  const poolLook = !isJoint || Math.max(anasDue, salmaDue) <= 0.005 ? 0 : anasDue >= salmaDue ? -18 : 18;

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
  const spentSummary = `${Math.round(spentPct ?? 0)}% spent` + (overspent > 0 ? `, ${fmt(overspent)} MAD overspent` : "");
  const pool = hasPlan && (
    <MascotSpill
      size={HOME_POOL_SIZE}
     
      hintKey="mascot-spill-hint"
      label={`This month: ${spentSummary} (${fmt(spent)} of ${fmt(planned ?? 0)} MAD)${topSpentLabel}`}
      onOpenChange={setPoolOpen}
      details={<>
        {Math.round(spentPct ?? 0)}% spent
        {overspent > 0 && <span style={{ color: "var(--danger)" }}> · <Money value={overspent} /> overspent</span>}
      </>}
    >
      <MascotHero variant="pool" size={HOME_POOL_SIZE} items={poolOpen ? topSpent : undefined} scope={value} level={1 - spent / (planned ?? 1)} warn={poolWarn} spentPct={spentPct} balance={balance} available={available ?? 0} lookYaw={poolLook} />
    </MascotSpill>
  );

  return (
    <div style={switcherStyle}>
      <section className="wallet-overview-card" style={wrapStyle} aria-label="Wallet overview">
        <div style={heroStyle} key={value}>
          {monthlyLoading ? <HeroSkeleton size={HOME_POOL_SIZE} /> : monthlyError ? (
            <span role="status" style={{ ...captionStyle, minHeight: HOME_POOL_SIZE, display: "grid", placeItems: "center" }}>Monthly details unavailable</span>
          ) : isJoint && contribStatus ? (
            // Joint: the pooled jar in the middle, each partner's own jar beside it,
            // filled by how much of their share they've put in this month.
            <JointFamily contribStatus={contribStatus}>
              {pool || <span style={captionStyle}>No monthly plan</span>}
            </JointFamily>
          ) : (
            pool || <span style={captionStyle}>No monthly plan</span>
          )}

          <div style={numberGroupStyle}>
            <span style={labelStyle}>Balance</span>
            <div style={amountRowStyle} aria-label="Balance">
              <span style={bigNumberStyle(isOver)}><AnimatedCounter value={balance ?? 0} /></span>
              <Currency />
            </div>
          </div>
        </div>
      </section>

      {!monthlyLoading && !monthlyError && isJoint && !contribStatus && (
        <p style={contribUnavailableStyle} role="note">
          Contributions unavailable: set both partners' split percentages (totalling 100%) and check the joint balance and category balances.
        </p>
      )}
    </div>
  );
}

/**
 * Joint's mascot family: the pool (children) with each partner's jar cuddled
 * against it. Shared by Home and Budget so Joint looks the same on both; the
 * pool must be MASCOT_HERO_SIZE for the cuddle geometry to line up.
 */
type JointFamilyProps = { children: ReactNode } & (
  | { contribStatus: ContribStatus; planningCapacity?: never }
  | { planningCapacity: { anas: number; salma: number }; contribStatus?: never }
);

export function JointFamily({ contribStatus, planningCapacity, children }: JointFamilyProps) {
  return (
    <div style={familyRowStyle}>
      <PartnerJar scope="anas" name="Anas" actual={contribStatus?.anasActual ?? 0} plan={contribStatus?.anasPlan ?? 0} capacity={planningCapacity?.anas} />
      {children}
      <PartnerJar scope="salma" name="Salma" actual={contribStatus?.salmaActual ?? 0} plan={contribStatus?.salmaPlan ?? 0} capacity={planningCapacity?.salma} />
    </div>
  );
}

/**
 * A partner's own jar beside the joint pool. Its level is how much of their
 * share of the joint budget they've contributed this month: full once settled.
 * They look towards the joint pool; the face is happy once settled, sheepish
 * while something is still due. Tapping spills their status.
 */
function PartnerJar({ scope, name, actual, plan, capacity }: {
  scope: "anas" | "salma";
  name: string;
  actual: number;
  plan: number;
  capacity?: number;
}) {
  const due = Math.max(0, plan - actual);
  const overpaid = Math.max(0, actual - plan);
  const settled = due <= 0.005;
  const rounded = Math.round(settled ? overpaid : due);
  const amount = rounded > 0 ? fmt(rounded) : "<1";
  const note = !settled ? "due" : overpaid > 0.005 ? "above plan" : null;
  // Shown without the currency (the app has one); spoken with it.
  const status = note ? `${amount} ${note}` : "Settled";
  const spoken = note ? `${amount} MAD ${note}` : "Settled";
  const planning = capacity !== undefined;
  const planningAmount = fmt(Math.round(capacity ?? 0));
  const level = planning ? 1 : plan > 0 ? Math.min(1, actual / plan) : 1;
  // Shape and colour say who this is, so there's no visible name; it stays in the
  // accessible label. Cuddled up: level with the pool, touching it, leaning in.
  // Tapped, their details come out of their empty side (Anas's left, Salma's
  // right), so they stay cuddled and never run into the pool.
  const left = scope === "anas";
  const lean = left ? CUDDLE_LEAN.anas : -CUDDLE_LEAN.salma;
  return (
    <div style={{ ...partnerJarStyle, paddingTop: CUDDLE_DROP, [left ? "marginRight" : "marginLeft"]: -(CUDDLE_PULL + CUDDLE_PULL_EXTRA[scope]) }}>
      <MascotSpill size={PARTNER_JAR_SIZE} label={planning ? `${name}: ${planningAmount} MAD can contribute after personal plan` : `${name}: ${spoken}`} initiallyOpen={planning} details={planning ? <span style={{ display: "grid", gap: 2 }}><span style={{ fontSize: 12 }}>I can give</span><Money value={Math.round(capacity ?? 0)} /></span> : status} side={left ? "left" : "right"}>
        <Mascot
          target={{ scope, gap: 0, mood: planning ? "curious" : settled ? "happy" : "worried", fill: level, outline: "partner", lookYaw: left ? 14 : -14 }}
          size={PARTNER_JAR_SIZE}
          style={{ transform: `rotate(${lean}deg)`, transformOrigin: "50% 85%" }}
          // Keep the water level with the ground while the jar leans.
          tilt={(lean * Math.PI) / 180}
        />
      </MascotSpill>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const contribUnavailableStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--muted)", textAlign: "center" };

const switcherStyle: CSSProperties = { display: "grid", gap: 16 };

const wrapStyle: CSSProperties = { display: "grid", padding: "20px 0 12px", background: "transparent", boxShadow: "none" };

const heroStyle: CSSProperties = { display: "grid", gap: 8, justifyItems: "center", animation: "fadeUp 0.22s ease both" };

/** The pool with the partners cuddled against it: jar tops aligned, partners dropped to rest level with it. */
const familyRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto auto auto",
  justifyContent: "center",
  alignItems: "start",
  columnGap: 0,
};

/** In front of the pool where they overlap its edge. */
const partnerJarStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  justifyItems: "center",
  width: PARTNER_JAR_SIZE,
  minWidth: 0,
  color: "var(--text)",
  textAlign: "center",
};

const numberGroupStyle: CSSProperties = { display: "grid", gap: 4, justifyItems: "center", textAlign: "center", marginTop: 10 };

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)" };

const amountRowStyle: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 };

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

const captionStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text2)",
};
