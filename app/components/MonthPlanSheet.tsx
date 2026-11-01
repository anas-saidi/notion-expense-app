"use client";
import { PlanPartnerRemaining } from "./PlanPartnerRemaining";
import { clearUnchangedPlanDraft, parsePlanDraft, planDraftKey, restorePlanDraft, type LocalPlanDraft } from "./month-plan-draft";
import { MonthPlanReview } from "./MonthPlanReview";
import { MonthPlanReceipt } from "./MonthPlanReceipt";
import { createPlanReceipt, confirmPlanReceipt, persistMonthPlan, type PlanReceipt } from "./month-plan-receipt";
import { categoryIconSource } from "../../lib/category-icons";

import { HeroSkeleton, Skeleton, SkeletonRegion, SkeletonRows } from "./ui/Skeleton";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fetchApiJson, fetchMonthlyData } from "../../lib/app-data";
import { useReducedMotion } from "motion/react";
import type { Account, BudgetScope, Category } from "./app-types";
import { BUDGET_SCOPE_LABELS, categoryMatchesScope, getCategoryScope, fmt, monthBounds, parseAmount, today } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { calculateMonthPlanCapacity, getPlanningSplit, planCost, type PlanAmounts } from "./month-plan-capacity";
import { JointFamily } from "./WalletCardSwitcher";
import { Money } from "./Money";
import { MascotHero } from "./mascot/MascotHero";
import { MascotTap } from "./mascot/MascotTap";
import { allocationJarItems } from "./mascot/budgetJar";
import type { Mood } from "./mascot/poses";
import { BottomSheet } from "./ui/BottomSheet";
import { ProgressiveBlur, useScrollEdges } from "./ui/ProgressiveBlur";
import { Banner } from "./ui/Banner";
import { Fact, Summary, joinClauses } from "./ui/Summary";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, FreezeIcon, XIcon } from "./ui/icons";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { freezeMonthPlanCategory } from "./month-plan-actions";
import { SlideToConfirm } from "./SlideToConfirm";
import { SectionToggle } from "./ui/SectionToggle";
import { pickerChipStyle } from "./TransactionPickers";
import { GlobalBudgetScopePicker } from "./ui/ScopeChipBar";
import "./month-plan-desktop.css";
import { ContributionAgreementEditor, contributionMonthName } from "./ContributionDetails";
import type { ContributionAgreement, ContributionLedger } from "../../lib/contribution-agreements";

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Budget groups from most to least essential, so scrolling down goes from must-pay to optional. */
const BUDGET_GROUPS: Array<{ key: string; label: string; matches: (type: string) => boolean }> = [
  { key: "obligations", label: "Obligations", matches: (t) => t === "obligations" },
  { key: "long-term", label: "Long term", matches: (t) => t === "long term" },
  { key: "wants", label: "Wants", matches: (t) => t === "wants" },
];

const normId = (id: string | null | undefined) => (id ?? "").replace(/-/g, "").toLowerCase();

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month: string, format: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: format }).format(new Date(y, m - 1, 1));
}

/** Months from `month` up to and including the goal date's month (at least 1). */
function monthsUntil(month: string, goalDate: string): number {
  const [y, m] = month.split("-").map(Number);
  const [gy, gm] = goalDate.slice(0, 7).split("-").map(Number);
  return Math.max(1, (gy - y) * 12 + (gm - m) + 1);
}

function sumByCategory(entries: Array<{ categoryId?: string | null; total?: number; planned?: number; reverse?: boolean }>) {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (!e.categoryId || e.reverse) continue;
    const key = normId(e.categoryId);
    map.set(key, (map.get(key) ?? 0) + (e.total ?? e.planned ?? 0));
  }
  return map;
}

/* ─── Types ───────────────────────────────────────────────────────── */

type MonthPlanSheetProps = {
  advanceReserve?: number;
  advances?: ContributionLedger | null;
  contributionsReady?: boolean;
  open: boolean;
  onClose: () => void;
  /** Called after a save so the app can refresh balances and the Home banner. */
  onSaved: () => void;
  onDraftSaved: () => void;
  /** Called after a category is unfrozen so the app can refetch categories. */
  onCategoriesChanged: () => void;
  /** "YYYY-MM" of the month being planned (current month when still unfunded, otherwise next month). */
  planningMonth: string;
  /** The opening wallet. Further wallet changes remain local to this planning session. */
  scope: BudgetScope;
  /** Opens the partner's over-assigned account, where the commitment behind a blocker can actually be fixed. */
  onOpenOverAssigned?: (partner: "anas" | "salma") => void;
  /** Opens Contributions, where each person's advance and its repayment live. */
  onOpenContributions?: () => void;
  personalScope: Exclude<BudgetScope, "joint">;
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  /** Unassigned capacity after current commitments, before next month's plan. */
  planningCapacity: PlanAmounts;
};

/* ─── Main component ──────────────────────────────────────────────── */

export function MonthPlanSheet({
  advanceReserve = 0,
  advances,
  contributionsReady = true,
  open,
  onClose,
  onSaved,
  onDraftSaved,
  onCategoriesChanged,
  planningMonth,
  scope: openingScope,
  onOpenOverAssigned,
  onOpenContributions,
  personalScope,
  categories,
  frozenCategories,
  accounts,
  planningCapacity,
}: MonthPlanSheetProps) {
  const [scope, onScopeChange] = useState<BudgetScope>(openingScope);
  const reduceMotion = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  const [expressions, setExpressions] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1000px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const currentMonth = shiftMonth(planningMonth, -1);
  const planLabel = monthName(planningMonth);

  // Saved plan for the planning month, and this month's plan + spending (for context).
  const [saved, setSaved] = useState<Map<string, number>>(new Map());
  const [agreement, setAgreement] = useState<ContributionAgreement | undefined>();
  const [currentPlanned, setCurrentPlanned] = useState<Map<string, number>>(new Map());
  const [currentSpent, setCurrentSpent] = useState<Map<string, number>>(new Map());
  // Spending already recorded in the month being planned (only when that's this calendar month).
  const [spentSoFar, setSpentSoFar] = useState<Map<string, number>>(new Map());
  const planningThisMonth = planningMonth === today().slice(0, 7);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Draft amounts by normalised category id; missing = the saved amount.
  const [draft, setDraft] = useState<Record<string, number>>({});
  const draftKey = planDraftKey(personalScope, planningMonth);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [locallyFrozen, setLocallyFrozen] = useState<Category[]>([]);
  const [freezing, setFreezing] = useState<string | null>(null);
  const freezeLock = useRef(false);
  const [revived, setRevived] = useState<Category[]>([]);
  const [unfreezing, setUnfreezing] = useState<string | null>(null);
  // Sections are open by default; Frozen starts closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["frozen"]));
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [receipt, setReceipt] = useState<PlanReceipt | null>(null);
  const saveLock = useRef(false);
  const planPanel = useRef<HTMLDivElement>(null);
  const saveSession = useRef(0);
  const planRead = useRef(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Once the hero number scrolls away, a compact bar keeps the jar and number in view.
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [heroTarget, setHeroTarget] = useState<HTMLSpanElement | null>(null);
  const [heroHidden, setHeroHidden] = useState(false);
  const { below: rowsBelow } = useScrollEdges(scrollRoot);

  useEffect(() => {
    if (!open) return;
    const root = scrollRoot;
    const target = heroTarget;
    if (!root || !target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setHeroHidden(!entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? root.getBoundingClientRect().top));
    }, { root, threshold: 0, rootMargin: `-${STICKY_BAR_H}px 0px 0px 0px` });
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, scrollRoot, heroTarget]);

  const loadPlan = async () => {
    const request = ++planRead.current;
    setLoading(true);
    setLoadError("");
    try {
      const [funds, summary, agreements, thisMonth] = await Promise.all([
        fetchApiJson<{ funds: any[] }>(`/api/monthly-planning/funds?month=${planningMonth}`),
        fetchMonthlyData(currentMonth),
        fetchApiJson<{ agreements: ContributionAgreement[] }>("/api/contribution-agreements"),
        planningThisMonth ? fetchMonthlyData(planningMonth) : Promise.resolve(null),
      ]);
      if (request !== planRead.current) return;
      setSpentSoFar(sumByCategory(thisMonth?.summary?.spentByCategory ?? []));
      setAgreement(agreements.agreements.find(a => a.month === planningMonth));
      const savedAmounts = sumByCategory(funds.funds ?? []);
      setSaved(savedAmounts);
      try {
        const raw = localStorage.getItem(draftKey);
        const stored = parsePlanDraft(raw, planningMonth);
        setHasLocalDraft(!!stored);
        if (stored) {
          const activeIds = new Set(categories.filter(c => !c.archived && !c.snoozed).map(c => normId(c.id)));
          const restored = restorePlanDraft(stored, savedAmounts, activeIds);
          setDraft(restored.amounts);
          setExpressions(restored.expressions);
          onScopeChange(stored.scope);
          setDraftNotice(restored.changedSinceDraft ? "The saved plan changed since this draft. Review the amounts before saving." : restored.unavailable ? "Some draft categories are no longer available. Review the remaining amounts." : "");
        } else if (raw) setDraftNotice("The browser draft could not be restored. Your saved plan is unchanged.");
      } catch { setDraftNotice("Browser drafts are unavailable. Check this browser’s storage settings."); }
      setCurrentPlanned(sumByCategory(summary.summary?.assignedByCategory ?? []));
      setCurrentSpent(sumByCategory(summary.summary?.spentByCategory ?? []));
    } catch (e) {
      if (request === planRead.current) setLoadError(e instanceof Error ? e.message : "Couldn't load the plan");
    } finally {
      if (request === planRead.current) setLoading(false);
    }
  };

  useEffect(() => {
    saveSession.current += 1;
    planRead.current += 1;
    setReceipt(null);
    if (!open) { setLoading(true); return; }
    onScopeChange(openingScope);
    setDraft({});
    setExpressions({});
    setReviewing(false);
    setRevived([]);
    setLocallyFrozen([]);
    setHeroHidden(false);
    setCollapsed(new Set(["frozen"]));
    setSaveError("");
    setHasLocalDraft(false);
    setDraftNotice("");
    void loadPlan();
  }, [open, planningMonth, personalScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountFor = (cat: Category) => draft[normId(cat.id)] ?? saved.get(normId(cat.id)) ?? 0;

  // Active categories, plus any unfrozen here that the app hasn't refetched yet.
  const activeCategories = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return [...categories, ...revived.filter((c) => !ids.has(c.id))].filter((c) => !c.archived && !locallyFrozen.some((f) => normId(f.id) === normId(c.id)));
  }, [categories, revived, locallyFrozen]);
  const scopeCategories = useMemo(
    () => activeCategories.filter((c) => categoryMatchesScope(c, scope, accounts)),
    [activeCategories, scope, accounts],
  );

  // Biggest categories first, by this month's plan and spending (never by the draft, so rows don't jump while typing).
  const weight = (cat: Category) =>
    Math.max(currentPlanned.get(normId(cat.id)) ?? 0, currentSpent.get(normId(cat.id)) ?? 0, cat.available ?? 0);
  const byWeight = (a: Category, b: Category) => weight(b) - weight(a) || a.name.localeCompare(b.name);
  const savingsCategories = useMemo(() => scopeCategories.filter(isSavingsCategory).sort(byWeight), [scopeCategories, currentPlanned, currentSpent]); // eslint-disable-line react-hooks/exhaustive-deps
  const budgetGroups = useMemo(() => {
    const budgets = scopeCategories.filter((c) => !isSavingsCategory(c)).sort(byWeight);
    const typeOf = (c: Category) => (c.type[0] ?? "").trim().toLowerCase();
    const groups = BUDGET_GROUPS.map((g) => ({ key: g.key, label: g.label, items: budgets.filter((c) => g.matches(typeOf(c))) }));
    const other = budgets.filter((c) => !BUDGET_GROUPS.some((g) => g.matches(typeOf(c))));
    return [...groups, { key: "other", label: "Other", items: other }].filter((g) => g.items.length > 0);
  }, [scopeCategories, currentPlanned, currentSpent]); // eslint-disable-line react-hooks/exhaustive-deps

  const frozenInScope = useMemo(() => {
    const revivedIds = new Set(revived.map((c) => c.id));
    return [...new Map([...frozenCategories, ...locallyFrozen].map((c) => [normId(c.id), c])).values()].filter((c) => !c.archived && !revivedIds.has(c.id) && categoryMatchesScope(c, scope, accounts));
  }, [frozenCategories, locallyFrozen, revived, scope, accounts]);

  // The formula doesn't see next month's funds yet, so the saved plan comes off here.
  const plannedTotal = scopeCategories.reduce((sum, c) => sum + amountFor(c), 0);
  const savedTotal = scopeCategories.reduce((sum, c) => sum + (saved.get(normId(c.id)) ?? 0), 0);
  // Edits survive switching modes, and one save covers every wallet.
  const changed = activeCategories.filter((c) => amountFor(c) !== (saved.get(normId(c.id)) ?? 0));
  const hasCurrentPlan = scopeCategories.some((c) => (currentPlanned.get(normId(c.id)) ?? 0) > 0);

  const split = useMemo(() => getPlanningSplit(accounts), [accounts]);

  // Include saved frozen categories as commitments; drafts in every wallet
  // participate immediately, before any of them are saved.
  // Totals are what you planned; costs are what that takes from unassigned money. Planning this month,
  // spending already recorded comes off the cost (planCost), since Ready To Assign already absorbed it.
  const totals: PlanAmounts = { joint: 0, anas: 0, salma: 0 };
  const costs: PlanAmounts = { joint: 0, anas: 0, salma: 0 };
  const catalog = new Map([...frozenCategories, ...activeCategories].map((c) => [normId(c.id), c]));
  for (const cat of catalog.values()) {
    const owner = getCategoryScope(cat, accounts);
    if (!owner) continue;
    totals[owner] += amountFor(cat);
    costs[owner] += planningThisMonth && cat.available != null ? planCost(amountFor(cat), cat.available - (saved.get(normId(cat.id)) ?? 0)) : amountFor(cat);
  }
  const capacity = calculateMonthPlanCapacity(planningCapacity, costs, split);
  const confirmingAgreement = !agreement && totals.joint > 0;
  const notAssigned = capacity.pool[scope];
  const left = capacity.left[scope];
  const shortPartners = (["anas", "salma"] as const).filter((partner) => capacity.left[partner] < -0.005);
  const capacityError = shortPartners.length ? "short" : "";
  // One cause per number: Joint's gap and who covers it, then each partner whose own money is already
  // committed (or runs out after planning). The hero number is the result; the sentence says why.
  // Never "for this plan": with nothing planned, every shortfall is one that already exists.
  const name = (partner: "anas" | "salma") => BUDGET_SCOPE_LABELS[partner];
  const roundUp = (value: number) => fmt(Math.ceil(value - 0.005));
  const jointCovered = capacity.due.anas + capacity.due.salma > 0.005;
  const jointReason = planningCapacity.joint < 0 && totals.joint > 0 ? "Joint is already short and its plan needs more"
    : planningCapacity.joint < 0 ? "Joint is already short" : "Joint's plan needs more than it holds";
  // Each view only talks about its own money: Joint names who covers its gap; a partner's view adds their own shortfall.
  const partnerClauses = shortPartners.filter((partner) => partner === scope).map((partner) => {
    const open = partner === scope ? undefined : () => onScopeChange(partner);
    return planningCapacity[partner] < -0.005
      ? <span key={partner}><Fact>{name(partner)}</Fact>&rsquo;s money is already <Fact tone="danger" onClick={open} label={`Show ${name(partner)}'s plan`}>{roundUp(-planningCapacity[partner])} over-assigned</Fact></span>
      : <span key={partner}><Fact>{name(partner)}</Fact> is <Fact tone="danger" onClick={open} label={`Show ${name(partner)}'s plan`}>{roundUp(-capacity.left[partner])} short</Fact> after planning</span>;
  });
  // A shortfall rounds up everywhere, so the number and the sentence never disagree by one.
  const shownLeft = left < 0 ? -Math.ceil(-left - 0.005) : Math.round(left);
  // One thing at a time: in Joint's view, a partner whose money is already committed blocks saving, so that
  // is all the sentence says until it's resolved. It names the amount, not the account (it opens their view).
  const blockers = scope === "joint" ? (["anas", "salma"] as const).filter((partner) => planningCapacity[partner] < -0.005) : [];
  const shortfallSummary = blockers.length > 0 ? <Summary className="plan-shortfall">{joinClauses(blockers.map((partner) => <span key={partner}><Fact>{name(partner)}</Fact> needs to free up <Fact tone="danger" onClick={() => onOpenOverAssigned ? onOpenOverAssigned(partner) : onScopeChange(partner)} label={`Review ${name(partner)}'s over-assigned account`}>{roundUp(-planningCapacity[partner])}</Fact></span>))} first.</Summary>
    : (jointCovered || partnerClauses.length > 0) && <Summary className="plan-shortfall">
    {jointCovered && (scope === "joint"
      ? <>{jointReason}, so <Fact>{name("anas")}</Fact> puts in <Fact>{fmt(Math.round(capacity.due.anas))}</Fact> and <Fact>{name("salma")}</Fact> <Fact>{fmt(Math.round(capacity.due.salma))}</Fact>.</>
      : capacity.due[scope] > 0.005 && <>{jointReason}, so <Fact>{name(scope)}</Fact> puts in <Fact>{fmt(Math.round(capacity.due[scope]))}</Fact>.</>)}
    {jointCovered && (scope === "joint" || capacity.due[scope] > 0.005) && partnerClauses.length > 0 && " "}
    {partnerClauses.length > 0 && <>{joinClauses(partnerClauses)}.</>}
  </Summary>;

  const capacityLabel = left < 0 ? "Over capacity" : "Unassigned";
  const partnerRemaining = contributionsReady
    ? <PlanPartnerRemaining scope={scope} left={capacity.left} />
    : <SkeletonRegion label="Loading remaining amounts"><Skeleton style={{ width: 140, height: 14, marginBottom: 12 }} /><Skeleton style={{ height: 40 }} /></SkeletonRegion>;

  // After Joint's plan is saved, each partner sees what's left of their share, kept current by every transfer to
  // Joined and every Joint bill they pay from their own account (both already count as contributions). An advance
  // Joined owes them is applied with one tap: it counts toward this month's share and clears the debt, moving no cash.
  const [applying, setApplying] = useState<"anas" | "salma" | null>(null);
  const [applyError, setApplyError] = useState("");
  const applyIds = useRef<Record<string, string>>({});
  const monthLedger = advances?.months.find((m) => m.month === planningMonth);
  const contributionRows = scope !== "joint" || !agreement || changed.length > 0 ? [] : (["anas", "salma"] as const).flatMap((partner) => {
    const left = Math.max(0, Math.round((agreement.targets[partner] - (monthLedger?.contributed[partner] ?? 0)) * 100) / 100);
    const owed = Math.round((advances?.outstanding[partner] ?? 0) * 100) / 100;
    return left >= 0.5 ? [{ partner, left, apply: Math.min(owed, left) }] : [];
  });
  const applyAdvance = async ({ partner, apply }: (typeof contributionRows)[number]) => {
    if (applying) return;
    setApplying(partner); setApplyError("");
    try {
      applyIds.current[partner] ??= crypto.randomUUID();
      const response = await fetch("/api/contribution-offsets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner, amount: apply, date: today(), requestId: applyIds.current[partner] }) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Couldn't apply the advance.");
      delete applyIds.current[partner];
      onSaved();
    } catch (error) { setApplyError(error instanceof Error ? error.message : "Couldn't apply the advance. Retry to finish it safely."); }
    finally { setApplying(null); }
  };
  const settleList = contributionRows.length > 0 && <div className="plan-settle">
    {contributionRows.map((row) => <div key={row.partner} className="plan-settle-row">
      <Summary className="plan-shortfall"><Fact>{name(row.partner)}</Fact> has <Fact>{fmt(Math.round(row.left))}</Fact> left to put in</Summary>
      {row.apply >= 0.5 && <button type="button" className="plan-copy" disabled={!!applying} onClick={() => void applyAdvance(row)} aria-label={`Apply ${fmt(row.apply)} MAD of ${name(row.partner)}'s advance to ${planLabel}`}>{applying === row.partner ? "Applying…" : `Apply ${fmt(Math.round(row.apply))}`}</button>}
    </div>)}
    {applyError && <Banner role="alert" tone="danger" compact>{applyError}</Banner>}
  </div>;
  const personalRemaining = {
    anas: Math.max(0, planningCapacity.anas - costs.anas),
    salma: Math.max(0, planningCapacity.salma - costs.salma),
  };

  const jarItems = useMemo(
    () => allocationJarItems(
      scopeCategories.map((c) => ({ categoryId: c.id, icon: categoryIconSource(c.icon, c.name), amount: amountFor(c) })),
      Math.max(notAssigned, plannedTotal),
    ),
    [scopeCategories, draft, saved, notAssigned, plannedTotal], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const jarMood: Mood = left < 0 ? "worried" : plannedTotal > 0 && Math.round(left) === 0 ? "happy" : left > 0 ? "curious" : "idle";

  const setAmount = (cat: Category, value: number) =>
    setDraft((prev) => ({ ...prev, [normId(cat.id)]: Math.max(0, Math.round(value * 100) / 100) }));

  const copyCurrentPlan = () => {
    setExpressions((prev) => {
      const next = { ...prev };
      for (const cat of scopeCategories) {
        const value = currentPlanned.get(normId(cat.id));
        if (value && value > 0) delete next[normId(cat.id)];
      }
      return next;
    });
    setDraft((prev) => {
      const next = { ...prev };
      for (const cat of scopeCategories) {
        const value = currentPlanned.get(normId(cat.id));
        if (value && value > 0) next[normId(cat.id)] = value;
      }
      return next;
    });
  };

  const unfreeze = async (cat: Category) => {
    setUnfreezing(cat.id);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, snoozed: false }),
      });
      if (!res.ok) throw new Error("Couldn't unfreeze");
      setLocallyFrozen((prev) => prev.filter((c) => c.id !== cat.id));
      setRevived((prev) => [...prev, { ...cat, snoozed: false }]);
      onCategoriesChanged();
    } catch {
      setSaveError(`Couldn't unfreeze ${cat.name}`);
    } finally {
      setUnfreezing(null);
    }
  };

  const freeze = async (cat: Category): Promise<boolean> => {
    if (freezeLock.current || loading || saving || loadError) return false;
    freezeLock.current = true;
    setFreezing(cat.id);
    setSaveError("");
    try {
      await freezeMonthPlanCategory({
        month: planningMonth,
        categoryId: cat.id,
        hasSavedAllocation: (saved.get(normId(cat.id)) ?? 0) > 0,
        onAllocationCleared: () => {
          setSaved((prev) => new Map(prev).set(normId(cat.id), 0));
          setAmount(cat, 0);
          onSaved();
        },
      });
      setAmount(cat, 0);
      setExpressions(prev => { const next = { ...prev }; delete next[normId(cat.id)]; return next; });
      setRevived((prev) => prev.filter((c) => c.id !== cat.id));
      setLocallyFrozen((prev) => [...prev, { ...cat, snoozed: true }]);
      onCategoriesChanged();
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : `Couldn't freeze ${cat.name}`);
      return false;
    } finally {
      freezeLock.current = false;
      setFreezing(null);
    }
  };

  const saveDraft = () => {
    if (loading || saving || freezing || loadError) return;
    try {
      const entries = Object.fromEntries(activeCategories.flatMap(cat => {
        const id = normId(cat.id), amount = amountFor(cat), base = saved.get(id) ?? 0;
        return amount !== base || expressions[id] !== undefined ? [[id, { amount, base, ...(expressions[id] !== undefined ? { expression: expressions[id] } : {}) }]] : [];
      }));
      const local: LocalPlanDraft = { version: 1, month: planningMonth, scope, savedAt: new Date().toISOString(), entries };
      localStorage.setItem(draftKey, JSON.stringify(local));
      setHasLocalDraft(true);
      onDraftSaved();
      onClose();
    } catch { setSaveError("Couldn’t save the draft in this browser. Check storage settings and try again."); }
  };
  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
      setDraft({}); setExpressions({}); setHasLocalDraft(false); setDraftNotice(""); setReviewing(false);
    } catch { setSaveError("Couldn’t remove the draft from this browser."); }
  };
  const draftStatus = hasLocalDraft && <div className="plan-draft-status"><span>Browser draft restored</span><button type="button" className="plan-copy" disabled={saving || !!freezing} onClick={discardDraft}>Discard draft</button></div>;
  const draftWarning = draftNotice && <Banner tone="warning" compact>{draftNotice}</Banner>;

  const save = async () => {
    if (!changed.length || loading || saveLock.current || freezing || loadError || capacityError || !contributionsReady) return;
    saveLock.current = true;
    const session = saveSession.current;
    let storedDraft: string | null = null;
    try { storedDraft = localStorage.getItem(draftKey); } catch { /* Saving the actual plan does not require browser storage. */ }
    const snapshot = createPlanReceipt(planningMonth, [...catalog.values()].flatMap(cat => {
      const owner = getCategoryScope(cat, accounts);
      return owner ? [{ id: cat.id, name: cat.name, scope: owner, amount: amountFor(cat) }] : [];
    }));
    setSaving(true);
    setSaveError("");
    try {
      const result = await persistMonthPlan({
        month: planningMonth,
        allowClear: true,
        budgetItems: changed.map(c => ({ categoryId: c.id, amount: amountFor(c), defaultAccount: c.defaultAccount ?? null })),
      }, confirmingAgreement ? {
        month: planningMonth,
        targets: { anas: capacity.due.anas + (monthLedger?.contributed.anas ?? 0), salma: capacity.due.salma + (monthLedger?.contributed.salma ?? 0) },
        shares: split,
        expectedVersion: null,
      } : undefined);
      try { clearUnchangedPlanDraft(localStorage, draftKey, storedDraft); } catch { /* Keep a confirmed save successful even if browser storage becomes unavailable. */ }
      onSaved();
      // A response from a dismissed editor must not replace a newly opened month's draft.
      if (session !== saveSession.current) return;
      setSaved(prev => {
        const next = new Map(prev);
        for (const c of changed) next.set(normId(c.id), amountFor(c));
        return next;
      });
      setDraft({});
      setExpressions({});
      setHasLocalDraft(false);
      setDraftNotice("");
      setReviewing(false);
      if (result.agreement) setAgreement(result.agreement);
      setReceipt(confirmPlanReceipt(snapshot, result.agreement ?? agreement, result.warning));
    } catch (e) {
      if (session === saveSession.current) setSaveError(e instanceof Error ? e.message : "Couldn't save the plan");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const renderRow = (cat: Category, index: number, savings: boolean) => (
    <SwipeToDelete key={cat.id} variant="freeze" deleteLabel={`Freeze ${cat.name} and clear its ${planLabel} allocation`} disabled={loading || saving || !!freezing || !!loadError} onDelete={() => freeze(cat)}>
    <PlanRow
      cat={cat}
      index={index}
      savings={savings}
      amount={amountFor(cat)}
      currentPlanned={currentPlanned.get(normId(cat.id)) ?? 0}
      currentSpent={currentSpent.get(normId(cat.id)) ?? 0}
      planLabel={monthName(planningMonth, "short")}
      planningMonth={planningMonth}
      disabled={loading || saving || !!freezing}
      onChange={(value) => setAmount(cat, value)}
    />
    </SwipeToDelete>
  );

  const invalidExpressions = Object.values(expressions).some((text) => text.trim() !== "" && parseAmount(text) === null);
  const advanceMonths = advances?.months.filter(m => m.outstanding.anas + m.outstanding.salma > 0) ?? [];
  const contributionReservation = advanceReserve > 0 ? <section className="contribution-agreement" aria-label="Advances reserved before new allocations">
    <dl className="contribution-rows">{advanceMonths.map(m => <div key={m.month}><dt>Repay {contributionMonthName(m.month)} advances</dt><dd><Money value={Math.round(m.outstanding.anas + m.outstanding.salma)} /></dd></div>)}{advanceMonths.length !== 1 && <div className="contribution-emphasis"><dt>Reserved for repayments</dt><dd><Money value={Math.round(advanceReserve)} /></dd></div>}</dl>
  </section> : null;
  // Desktop: the advance is a row you can act on (opens Contributions, who's owed what and the repayments).
  const advanceRows = advanceReserve > 0 && <div className="plan-gaps">{advanceMonths.map(m => <button key={m.month} type="button" className="plan-gap" disabled={!onOpenContributions} onClick={onOpenContributions} aria-label={`${monthName(m.month)} advances owed back, ${fmt(Math.round(m.outstanding.anas + m.outstanding.salma))} MAD. Open contributions.`}>
    <span className="plan-gap-name">{monthName(m.month)} advances</span><span className="plan-gap-value">{fmt(Math.round(m.outstanding.anas + m.outstanding.salma))}</span>
  </button>)}</div>;
  const contributionAgreement = <ContributionAgreementEditor month={planningMonth} agreement={agreement} proposed={{ anas: capacity.due.anas + (advances?.months.find(m => m.month === planningMonth)?.contributed.anas ?? 0), salma: capacity.due.salma + (advances?.months.find(m => m.month === planningMonth)?.contributed.salma ?? 0) }} shares={split} disabled={loading || saving || changed.length > 0 || !!loadError || !!capacityError || !contributionsReady || totals.joint <= 0} onSaved={() => { void loadPlan(); onSaved(); }} />;
  // "From <last month>": only what the table can't say on its own (totals, gaps, a ranking). Spent and Last plan per
  // row are already in the table. Facts are tappable without looking like buttons: the category count filters the
  // table to the rows over plan, and a ranked gap jumps to its row's plan cell.
  const [onlyOver, setOnlyOver] = useState(false);
  const lastLabel = monthName(currentMonth);
  const gaps = scopeCategories.filter((c) => !isSavingsCategory(c))
    .map((cat) => ({ cat, gap: (currentSpent.get(normId(cat.id)) ?? 0) - (currentPlanned.get(normId(cat.id)) ?? 0) }))
    .filter((g) => g.gap >= 0.5).sort((a, b) => b.gap - a.gap);
  const overIds = new Set(gaps.map((g) => normId(g.cat.id)));
  const overTotal = gaps.reduce((sum, g) => sum + g.gap, 0);
  const lastSpentTotal = scopeCategories.filter((c) => !isSavingsCategory(c)).reduce((sum, c) => sum + Math.max(0, currentSpent.get(normId(c.id)) ?? 0), 0);
  const planTotal = scopeCategories.filter((c) => !isSavingsCategory(c)).reduce((sum, c) => sum + amountFor(c), 0);
  const focusRow = (id: string) => {
    if (onlyOver && !overIds.has(id)) setOnlyOver(false);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-plan-row="${id}"]`);
      row?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      row?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
  };
  const insights = lastSpentTotal > 0 && <section className="plan-insights" aria-label={`From ${lastLabel}`}>
    <h3 className="plan-insights-label">From {lastLabel}</h3>
    <Summary className="plan-shortfall">{gaps.length > 0
      ? <><Fact tone="danger">{fmt(Math.round(overTotal))} over</Fact> plan across <Fact onClick={() => setOnlyOver((value) => !value)} label={onlyOver ? "Show all categories" : `Show only the ${gaps.length} categories over plan`}>{gaps.length} {gaps.length === 1 ? "category" : "categories"}</Fact>.</>
      : <>Stayed <Fact tone="success">within plan</Fact>.</>}</Summary>
    {gaps.length > 0 && <ol className="plan-gaps">{gaps.slice(0, 3).map(({ cat, gap }) => <li key={cat.id}>
      <button type="button" className="plan-gap" onClick={() => focusRow(normId(cat.id))} aria-label={`${cat.name}, ${fmt(Math.round(gap))} MAD over plan in ${lastLabel}. Go to its plan.`}>
        <CategoryIcon icon={cat.icon} categoryName={cat.name} size={20} /><span className="plan-gap-name">{cat.name}</span><span className="plan-gap-amount">+{fmt(Math.round(gap))}</span>
      </button>
    </li>)}</ol>}
  </section>;
  // This plan against last month's spending: only once the plan has amounts, at the foot of the summary.
  const planCompare = planTotal > 0 && lastSpentTotal > 0 && (
    <div className="plan-compare" role="img" aria-label={`${planLabel} plan ${fmt(Math.round(planTotal))} MAD against ${fmt(Math.round(lastSpentTotal))} MAD spent in ${lastLabel}`}>
      <div className="plan-compare-track" aria-hidden="true"><span style={{ width: `${Math.min(100, planTotal / lastSpentTotal * 100)}%` }} /></div>
      <div className="plan-compare-labels" aria-hidden="true"><span>This plan <strong>{fmt(Math.round(planTotal))}</strong></span><span>{lastLabel} spent <strong>{fmt(Math.round(lastSpentTotal))}</strong></span></div>
    </div>
  );
  const desktopGroups = [
    ...(savingsCategories.length ? [{ key: "savings", label: "Savings", items: savingsCategories }] : []),
    ...budgetGroups,
  ].map((group) => onlyOver ? { ...group, items: group.items.filter((cat) => overIds.has(normId(cat.id))) } : group).filter((group) => group.items.length > 0);
  if (receipt) return (
    <BottomSheet lockBackground panelRef={planPanel} open={open} onClose={onClose} label="Plan saved" size="standard" desktopViewportCentered contentStyle={{ overflow: "auto" }}>
      <MonthPlanReceipt receipt={receipt} onDone={onClose} onReview={() => { setReceipt(null); requestAnimationFrame(() => planPanel.current?.focus({ preventScroll: true })); }} />
    </BottomSheet>
  );
  if (desktop) return (
    <BottomSheet lockBackground panelRef={planPanel} open={open} onClose={onClose} label={`Plan ${planLabel}`} desktopViewportCentered size="planning" desktopHeight="fill" maxHeight="calc(100dvh - 48px)" panelStyle={{ background: SHEET_BG }} contentStyle={contentStyle}>
      <div className="plan-desktop" data-plan-scope={scope}>
        <header className="sheet-header plan-desktop-header">
          <h1 className="plan-desktop-title">Plan {planLabel}</h1>
          <GlobalBudgetScopePicker label="Monthly plan wallet" value={scope} onChange={onScopeChange} personalScope={personalScope} />
          <button type="button" className="plan-desktop-close" onClick={onClose} style={closeButtonStyle} aria-label="Close"><XIcon size={20} /></button>
        </header>
        {loading ? <SkeletonRegion label="Loading monthly plan" style={{ padding: "0 var(--dialog-inset)" }}><SkeletonRows label="Loading planned categories" count={4} iconSize={44} /></SkeletonRegion> : loadError ? <Banner role="alert" tone="danger" compact title={loadError} action={<button type="button" onClick={() => void loadPlan()} style={textButtonStyle}>Retry</button>} /> : <div className="plan-desktop-body">
          <main className="plan-desktop-main">
            {draftStatus}
            {draftWarning}
            {reviewing ? <>
              <MonthPlanReview items={changed.map(cat => ({
                id: cat.id, name: cat.name, icon: cat.icon,
                owner: BUDGET_SCOPE_LABELS[getCategoryScope(cat, accounts) ?? scope],
                before: saved.get(normId(cat.id)) ?? 0, after: amountFor(cat),
              }))} onEdit={() => {
                setReviewing(false);
                requestAnimationFrame(() => (planPanel.current?.querySelector<HTMLInputElement>("input[data-changed]") ?? planPanel.current)?.focus());
              }} />
            </> : <>
              <div className="plan-table" role="table" aria-label={`${BUDGET_SCOPE_LABELS[scope]} category plan`}>
                <div className="plan-table-head" role="row"><span role="columnheader"><span className="sr-only">Category, </span>{desktopGroups[0]?.label}</span><span role="columnheader">Spent</span><span role="columnheader">Last plan</span><span role="columnheader" className="plan-column-action"><span className="sr-only">{planLabel} plan</span>{hasCurrentPlan && <button type="button" className="plan-copy" disabled={saving || !!freezing} onClick={copyCurrentPlan}>Copy last month</button>}</span></div>
                {desktopGroups.map((group, index) => <div key={group.key} role="rowgroup">{index > 0 && <div className="plan-group">{group.label}</div>}{group.items.map(cat => {
                  const id = normId(cat.id);
                  const changedRow = amountFor(cat) !== (saved.get(id) ?? 0);
                  return <div className="plan-table-row" role="row" key={id} data-plan-row={id}>
                    <div className="plan-category" role="cell"><CategoryIcon icon={cat.icon} categoryName={cat.name} size={32} /><span className="plan-category-name"><span>{cat.name}</span>{(spentSoFar.get(id) ?? 0) >= 0.5 && <small>{fmt(Math.round(spentSoFar.get(id)!))} spent so far</small>}</span></div>
                    {/* Spent, then the plan it's measured against, then the new plan: copy moves the middle column one step right. */}
                    <span role="cell" data-over={Math.round(currentSpent.get(id) ?? 0) > Math.round(currentPlanned.get(id) ?? 0) || undefined}>{fmt(Math.round(currentSpent.get(id) ?? 0))}</span><span role="cell">{fmt(Math.round(currentPlanned.get(id) ?? 0))}</span>
                    <label role="cell" className="plan-amount-cell"><input className="field-input plan-amount" data-changed={changedRow || undefined} type="text" inputMode="decimal" placeholder="—" aria-label={`${planLabel} plan for ${cat.name}${changedRow ? ", changed" : ""}`} aria-invalid={expressions[id] != null && expressions[id].trim() !== "" && parseAmount(expressions[id]) === null} value={expressions[id] ?? (amountFor(cat) ? String(amountFor(cat)) : "")} disabled={saving || !!freezing} onFocus={e => e.currentTarget.select()} onChange={e => { const text = e.target.value.replace(/[^\d+\-*/, .()]/g, ""); setExpressions(prev => ({ ...prev, [id]: text })); const value = text.trim() ? parseAmount(text) : 0; if (value !== null) setAmount(cat, value); }} onKeyDown={e => { if (e.key === "Enter" || e.key === "Tab") { const inputs = Array.from(e.currentTarget.closest(".plan-table")?.querySelectorAll<HTMLInputElement>("input:not(:disabled)") ?? []); const next = inputs[inputs.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)]; if (next) { e.preventDefault(); next.focus(); } else if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } }} /></label>
                    <button type="button" className="plan-freeze" disabled={saving || !!freezing} onClick={() => void freeze(cat)} aria-label={`Freeze ${cat.name} and clear its ${planLabel} allocation`} title={`Freeze ${cat.name}`}><FreezeIcon size={17} aria-hidden="true" /></button>
                  </div>;
                })}</div>)}
              </div>
              {!scopeCategories.length && <div style={emptyStyle}>No active {BUDGET_SCOPE_LABELS[scope]} categories.</div>}
              {frozenInScope.length > 0 && <section className="plan-frozen"><SectionToggle id="desktop-plan-frozen" label="Frozen" count={frozenInScope.length} open={!collapsed.has("frozen")} onToggle={() => toggleSection("frozen")} />{!collapsed.has("frozen") && frozenInScope.map(cat => <div key={cat.id} style={frozenRowStyle}><CategoryIcon icon={cat.icon} categoryName={cat.name} size={20} /><span style={frozenNameStyle}>{cat.name}</span><button type="button" onClick={() => void unfreeze(cat)} disabled={!!unfreezing || !!freezing || saving} style={unfreezeButtonStyle}>{unfreezing === cat.id ? "…" : "Unfreeze"}</button></div>)}</section>}
            </>}
          </main>
          <aside className="plan-summary" aria-label="Household summary">
            <div className="plan-summary-content">
            <div className="plan-summary-balance"><span>{capacityLabel}</span><strong className={left < 0 ? "plan-negative" : ""}>{shownLeft < 0 && "−"}<Money value={Math.abs(shownLeft)} currency /></strong></div>
            {partnerRemaining}
            {shortfallSummary}
            {/* The scope you're viewing already shows its total in the bar at the foot, so only the other scopes get a row. */}
            {(["joint", "anas", "salma"] as const).some(s => s !== scope && totals[s] > 0) && <dl className="plan-summary-lines">{(["joint", "anas", "salma"] as const).filter(s => s !== scope && totals[s] > 0).map(s => <div key={s} className="plan-summary-line"><dt>{BUDGET_SCOPE_LABELS[s]} planned</dt><dd>{fmt(Math.round(totals[s]))}</dd></div>)}</dl>}
            {confirmingAgreement && <p className="contribution-note">Saving the plan confirms {planLabel}'s contributions.</p>}
            {advanceRows}
            {insights}
            {(agreement || totals.joint > 0) && contributionAgreement}
            </div>
            <div className="plan-summary-actions">
              {planCompare}
              {(saveError || invalidExpressions) && <Banner role="alert" tone="danger" compact>{saveError || "Complete the amount before reviewing."}</Banner>}
              {settleList}
              {(hasLocalDraft || changed.length > 0 || Object.keys(expressions).length > 0) && <button type="button" className="plan-copy plan-save-draft" disabled={saving || !!freezing} onClick={saveDraft}>Save draft</button>}
              {changed.length ? <button type="button" className="plan-primary" disabled={saving || !!freezing || !!capacityError || invalidExpressions || !contributionsReady} onClick={() => reviewing ? void save() : setReviewing(true)}>{saving ? "Saving…" : reviewing ? "Save plan" : `Review ${changed.length} ${changed.length === 1 ? "change" : "changes"}`}</button> : savedTotal > 0 && !settleList && <span role="status">Plan saved</span>}
            </div>
          </aside>
        </div>}
      </div>
    </BottomSheet>
  );

  return (
    <BottomSheet
      lockBackground
      panelRef={planPanel}
      open={open}
      onClose={onClose}
      showHandle
      label={`Plan ${planLabel}`}
      detent="content"
      panelStyle={panelStyle}
      contentStyle={contentStyle}
    >
      <div style={innerStyle} className="planner-wrap" data-plan-scope={scope}>
        <header className="sheet-header" style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Plan {planLabel}</h1>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            <XIcon size={16} />
          </button>
        </header>

        {draftStatus}
        {draftWarning}
        <div className="plan-mobile-scope"><GlobalBudgetScopePicker label="Monthly plan wallet" value={scope} onChange={onScopeChange} personalScope={personalScope} /></div>
        <div style={scrollAreaStyle}>
          {/* The compact bar floats over the list on a blur that thins out below it — no hard bottom edge. */}
          <ProgressiveBlur
            position="top"
            height={STICKY_BAR_H + 44}
            fade={56}
            maxBlur={12}
            tint={SHEET_BG}
            visible={heroHidden && !loading && !loadError}
            reduceMotion={!!reduceMotion}
          />
          <div
            aria-hidden={!heroHidden || loading || !!loadError}
            style={{
              ...stickyBarStyle,
              opacity: heroHidden && !loading && !loadError ? 1 : 0,
              transform: heroHidden ? "translateY(0)" : "translateY(-4px)",
              transition: reduceMotion ? "none" : "opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: heroHidden ? "auto" : "none",
            }}
          >
            <MascotTap label="Tap planning mascot" tabIndex={heroHidden ? 0 : -1} style={{ margin: 0 }}><MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} size={52} style={{ margin: 0, flexShrink: 0 }} /></MascotTap>
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={stickyLabelStyle}>{capacityLabel}</span>
              <span style={{ ...stickyAmountStyle, color: left < 0 ? "var(--danger)" : "var(--text)" }}>
                {left < 0 ? "−" : ""}
                <Money value={Math.abs(shownLeft)} currency animated />
              </span>
            </div>
            {plannedTotal > 0 && (
              <span style={stickyPlannedStyle}>
                {fmt(Math.round(plannedTotal))} planned
              </span>
            )}
          </div>
        <div ref={setScrollRoot} style={scrollStyle}>
          {loading ? <SkeletonRegion label="Loading monthly plan">
            <HeroSkeleton label="Loading planning capacity" />
            <Skeleton style={{ width: 160, height: 44, margin: "16px auto 32px" }} />
            <SkeletonRows label="Loading planned categories" count={4} iconSize={60} />
          </SkeletonRegion> : loadError ? <Banner role="alert" tone="danger" compact title={loadError} action={<button type="button" onClick={() => void loadPlan()} style={textButtonStyle}>Retry</button>} /> : <>
          {/* Hero: the jar fills with the categories you plan; the number is what's still unassigned. */}
          <section aria-label={capacityLabel} style={heroStyle}>
            {scope === "joint" ? (
              <JointFamily planningCapacity={personalRemaining}>
                <MascotTap label="Tap planning mascot"><MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} style={{ marginBottom: -4 }} /></MascotTap>
              </JointFamily>
            ) : (
              <MascotTap label="Tap planning mascot"><MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} style={{ marginBottom: -4 }} /></MascotTap>
            )}
            <span style={heroLabelStyle}>{capacityLabel}</span>
            <span ref={setHeroTarget} style={{ ...heroAmountStyle, color: left < 0 ? "var(--danger)" : "var(--text)" }}>
              {left < 0 ? "−" : ""}
              <Money value={Math.abs(shownLeft)} currency animated />
            </span>
            {plannedTotal > 0 && (
              <span style={heroSubStyle}>
                {fmt(Math.round(plannedTotal))} planned{savedTotal !== plannedTotal ? " (not saved)" : ""}
              </span>
            )}
            {scope !== "joint" && (
              <span style={heroSubStyle}>{fmt(Math.round(capacity.due[scope]))} reserved for Joint</span>
            )}
          </section>

          {contributionReservation}
          {contributionAgreement}
          {[
            ...(savingsCategories.length ? [{ key: "savings", label: "Savings", items: savingsCategories, savings: true }] : []),
            ...budgetGroups.map((g) => ({ ...g, savings: false })),
          ].map((group) => {
            const open = !collapsed.has(group.key);
            return (
              <section key={group.key} aria-labelledby={`plan-${group.key}`} style={sectionStyle}>
                <SectionToggle
                  id={`plan-${group.key}`}
                  label={group.label}
                  count={group.items.length}
                  total={group.items.reduce((sum, c) => sum + amountFor(c), 0)}
                  open={open}
                  onToggle={() => toggleSection(group.key)}
                />
                {open && <div style={listStyle}>{group.items.map((c, i) => renderRow(c, i, group.savings))}</div>}
              </section>
            );
          })}

          {budgetGroups.length === 0 && (
            <div style={emptyStyle}>No active {BUDGET_SCOPE_LABELS[scope]} categories.</div>
          )}

          {frozenInScope.length > 0 && (
            <section aria-label="Frozen categories" style={sectionStyle}>
              <SectionToggle
                id="plan-frozen"
                label="Frozen"
                count={frozenInScope.length}
                open={!collapsed.has("frozen")}
                onToggle={() => toggleSection("frozen")}
              />
              {!collapsed.has("frozen") && (
                <div style={listStyle}>
                  {frozenInScope.map((cat) => (
                    <div key={cat.id} style={frozenRowStyle}>
                      <CategoryIcon icon={cat.icon} categoryName={cat.name} size={20} style={{ opacity: 0.5, flexShrink: 0 }} />
                      <span style={frozenNameStyle}>{cat.name}</span>
                      <button type="button" onClick={() => void unfreeze(cat)} disabled={!!unfreezing || !!freezing || saving} style={unfreezeButtonStyle}>
                        {unfreezing === cat.id ? "…" : "Unfreeze"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          </>}
        </div>
          {/* Rows melt into the footer rather than stopping at a hairline. */}
          <ProgressiveBlur position="bottom" height={28} maxBlur={4} tint={SHEET_BG} visible={rowsBelow} reduceMotion={!!reduceMotion} />
        </div>

        <footer className="sheet-footer" style={footerStyle}>
          {!loading && !loadError && saveError && <Banner role="alert" tone="danger" compact>{saveError}</Banner>}
          {!loading && !loadError && partnerRemaining}
          {!loading && !loadError && shortfallSummary}
          {!loading && !loadError && settleList}
          {!loading && !loadError && (hasCurrentPlan || hasLocalDraft || changed.length > 0) && <div className="plan-mobile-actions">
            {hasCurrentPlan && <button type="button" onClick={copyCurrentPlan} disabled={saving || !!freezing} style={copyLinkStyle}>Copy last month</button>}
            {(hasLocalDraft || changed.length > 0 || Object.keys(expressions).length > 0) && <button type="button" className="plan-copy plan-save-draft" disabled={saving || !!freezing} onClick={saveDraft}>Save draft</button>}
          </div>}
          <div style={footerRowStyle} className="planner-footer-row">
            {/* A month's plan is a big commitment: slide to save, so a stray tap never does. */}
            {loading ? <SkeletonRegion label="Loading plan status"><Skeleton style={{ width: 140, height: 18 }} /></SkeletonRegion> : loadError ? null : changed.length || saving ? (
              <SlideToConfirm label={confirmingAgreement ? "Save plan and contributions" : "Slide to save plan"} busy={saving} busyLabel="Saving…" disabled={loading || !!freezing || !!loadError || !!capacityError || !contributionsReady} onConfirm={() => void save()} />
            ) : (
              <span role="status" style={savedStatusStyle}>
                <CheckIcon size={16} aria-hidden="true" /> {savedTotal > 0 ? "Plan saved" : "Nothing planned yet"}
              </span>
            )}
          </div>
        </footer>
      </div>
    </BottomSheet>
  );
}

/* ─── Row ─────────────────────────────────────────────────────────── */

function PlanRow({ cat, index, savings, amount, currentPlanned, currentSpent, planLabel, planningMonth, disabled, onChange }: {
  cat: Category;
  index: number;
  savings: boolean;
  amount: number;
  currentPlanned: number;
  currentSpent: number;
  planLabel: string;
  planningMonth: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [rowFocused, setRowFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tapping in opens the row: the details and quick amounts that help pick a number.
  const open = text !== null || rowFocused;
  const available = cat.available ?? 0;

  const commit = () => {
    if (text === null) return;
    // Empty clears; an unfinished sum ("500+") keeps the last valid amount.
    const value = text.trim() ? parseAmount(text) : 0;
    if (value !== null) onChange(value);
    setText(null);
  };
  const fill = (value: number) => {
    const rounded = Math.round(value);
    setText(String(rounded));
    onChange(rounded);
  };

  let goalLine: string | null = null;
  let goalPace: number | null = null;
  if (savings && cat.goal && cat.goal > 0) {
    const remaining = Math.max(0, cat.goal - Math.max(0, available));
    goalPace = cat.goalDate && remaining > 0 ? remaining / monthsUntil(planningMonth, cat.goalDate) : null;
    goalLine = remaining === 0
      ? "Goal reached"
      : goalPace !== null
        ? `~${fmt(Math.round(goalPace))}/mo to reach ${fmt(Math.round(cat.goal))} by ${monthName(cat.goalDate!.slice(0, 7), "short")}`
        : `Goal ${fmt(Math.round(cat.goal))}`;
  }
  const hasLastMonth = currentPlanned > 0 || currentSpent > 0;
  const lastMonthLine = hasLastMonth
    ? `Last month: ${fmt(Math.round(currentSpent))}${currentPlanned > 0 ? ` of ${fmt(Math.round(currentPlanned))}` : " spent"}`
    : null;

  // Always: what needs attention (available, or overspent when below zero). Open: what helps pick the amount.
  const details: ReactNode[] = [];
  if (Math.round(available) !== 0) {
    details.push(
      <span key="available" style={{ color: available < 0 ? "var(--danger)" : undefined }}>
        {available < 0 ? `${fmt(Math.round(-available))} overspent` : `${fmt(Math.round(available))} available`}
      </span>,
    );
  }
  // History, not a warning: "over" is only ever Available below zero.
  if (lastMonthLine && open && !goalLine) {
    details.push(<span key="last">{lastMonthLine}</span>);
  }
  if (goalLine && open) details.push(<span key="goal">{goalLine}</span>);

  const quick: Array<{ label: string; value: number }> = [];
  if (currentPlanned > 0) quick.push({ label: `Last month ${fmt(Math.round(currentPlanned))}`, value: currentPlanned });
  if (currentSpent > 0 && Math.round(currentSpent) !== Math.round(currentPlanned)) quick.push({ label: `Spent ${fmt(Math.round(currentSpent))}`, value: currentSpent });
  if (goalPace !== null) quick.push({ label: `Goal pace ${fmt(Math.round(goalPace))}`, value: goalPace });
  const quickChoices = quick.filter((q) => Math.round(q.value) !== amount);

  return (
    <div
      onFocusCapture={() => setRowFocused(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRowFocused(false); }}
      style={{ ...rowStyle, ...(open ? rowOpenStyle : null), animation: `fadeUp 0.2s ${Math.min(index * 0.02, 0.15)}s ease both` }}
      onClick={(e) => { if (e.target === e.currentTarget || !(e.target as HTMLElement).closest("button, input")) inputRef.current?.focus(); }}
    >
      <div style={rowTopStyle}>
        <div style={rowIconStyle}><CategoryIcon icon={cat.icon} categoryName={cat.name} size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={rowNameStyle} title={cat.name}>{cat.name}</div>
          {details.map((detail, i) => <div key={i} style={rowMetaStyle}>{detail}</div>)}
        </div>
        <div style={rowInputColStyle}>
          <input
            ref={inputRef}
            className="field-input"
            type="text"
            inputMode="decimal"
            value={text ?? (amount > 0 ? String(amount) : "")}
            placeholder="0"
            disabled={disabled}
            onFocus={(e) => { setText(amount > 0 ? String(amount) : ""); e.target.select(); }}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d+\-*/, .()]/g, "");
              setText(next);
              // Update totals as you type; a half-typed sum like "500+" keeps the last value.
              const value = next.trim() ? parseAmount(next) : 0;
              if (value !== null) onChange(value);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setText(null); e.currentTarget.blur(); }
            }}
            aria-label={`${planLabel} plan for ${cat.name}`}
            style={inputStyle}
          />
          {open && amount > 0 && available > 0 && (
            <span style={startsStyle}>→ {fmt(Math.round(available + amount))}</span>
          )}
        </div>
      </div>
      {open && quickChoices.length > 0 && (
        <div role="group" aria-label={`Quick amounts for ${cat.name}`} style={quickRowStyle}>
          {quickChoices.map((q) => (
            <button
              key={q.label}
              type="button"
              // Keep the input focused so the row stays open while filling.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fill(q.value)}
              style={quickChipStyle}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

// What the panel actually paints: `.bottom-sheet-panel` forces --surface (!important) in both
// themes, so anything that has to blend with the header must use the same token.
const SHEET_BG = "var(--surface)";

const panelStyle: CSSProperties = {
  background: SHEET_BG,
  borderRadius: "24px 24px 0 0",
};

const contentStyle: CSSProperties = { overflow: "hidden", display: "flex", flexDirection: "column" };

const innerStyle: CSSProperties = { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 };

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "18px 16px 4px 20px",
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 800,
  color: "var(--text)",
  margin: 0,
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const scrollAreaStyle: CSSProperties = { flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" };

const STICKY_BAR_H = 68;

// Floats over the top of the list; its backdrop is the ProgressiveBlur beneath it.
const stickyBarStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: STICKY_BAR_H,
  boxSizing: "border-box",
  padding: "4px 20px 12px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  zIndex: 2,
};

const stickyLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  
  color: "var(--muted)",
};

const stickyAmountStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
};

const stickyPlannedStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 13,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const scrollStyle: CSSProperties = {
  // Contain swipe-row z-indices below the sibling progressive-blur layer.
  position: "relative",
  zIndex: 0,
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "0 16px 16px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignContent: "start",
  gap: 18,
};

const heroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  paddingBottom: 4,
};

const heroLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  
  color: "var(--muted)",
};

const heroAmountStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 48,
  fontWeight: 800,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  transition: "color 0.2s ease",
};

const heroSubStyle: CSSProperties = { fontSize: 13, color: "var(--text2)", fontVariantNumeric: "tabular-nums" };


const sectionStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, minWidth: 0 };

const listStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 };

const rowStyle: CSSProperties = {
  borderRadius: 16,
  background: "var(--surface)",
  padding: "10px 12px 10px 14px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  display: "grid",
  gap: 10,
  transition: "box-shadow 0.18s ease",
};

/** The row you're typing in lifts slightly, like a focused card. */
const rowOpenStyle: CSSProperties = { boxShadow: "var(--elevation-card)" };

const rowTopStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };

const quickRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 48 };

const quickChipStyle: CSSProperties = { ...pickerChipStyle, fontWeight: 500, color: "var(--text2)" };

const rowIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  background: "color-mix(in srgb, var(--surface2) 55%, var(--surface))",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const rowNameStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  marginBottom: 2,
};

const rowMetaStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const rowInputColStyle: CSSProperties = { display: "grid", justifyItems: "end", gap: 4, flexShrink: 0 };

// Sizing only; the look comes from .field-input like every other form field.
// 16px keeps iOS from zooming in on focus.
const inputStyle: CSSProperties = {
  width: 96,
  fontSize: 16,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const startsStyle: CSSProperties = { fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" };

const emptyStyle: CSSProperties = { padding: "24px 0", textAlign: "center", fontSize: 13, color: "var(--muted)" };

const frozenRowStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 14,
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 6px 0 14px",
};

const frozenNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const unfreezeButtonStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "0 12px",
  border: "none",
  background: "transparent",
  color: "var(--accent-foreground)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const textButtonStyle: CSSProperties = {
  minHeight: 44,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

const footerStyle: CSSProperties = {
  padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
  flexShrink: 0,
  display: "grid",
  gap: 10,
};

const footerRowStyle: CSSProperties = { display: "flex", gap: 10, minHeight: 60, alignItems: "center" };

const copyLinkStyle: CSSProperties = {
  minHeight: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  justifySelf: "center",
};

const savedStatusStyle: CSSProperties = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--muted)",
};

export default MonthPlanSheet;
