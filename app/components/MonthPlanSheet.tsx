"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import type { Account, BudgetScope, Category } from "./app-types";
import { BUDGET_SCOPE_LABELS, categoryMatchesScope, getCategoryScope, fmt, monthBounds, parseAmount } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { calculateMonthPlanCapacity, getPlanningSplit, type PlanAmounts } from "./month-plan-capacity";
import { JointFamily } from "./WalletCardSwitcher";
import { Money } from "./Money";
import { MascotHero } from "./mascot/MascotHero";
import { allocationJarItems } from "./mascot/budgetJar";
import type { Mood } from "./mascot/poses";
import { BottomSheet } from "./ui/BottomSheet";
import { ProgressiveBlur } from "./ui/ProgressiveBlur";
import { Banner } from "./ui/Banner";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, XIcon } from "./ui/icons";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { freezeMonthPlanCategory } from "./month-plan-actions";
import { SlideToConfirm } from "./SlideToConfirm";
import { SectionToggle } from "./ui/SectionToggle";
import { pickerChipStyle } from "./TransactionPickers";

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
  open: boolean;
  onClose: () => void;
  /** Called after a save so the app can refresh balances and the Home banner. */
  onSaved: () => void;
  /** Called after a category is unfrozen so the app can refetch categories. */
  onCategoriesChanged: () => void;
  /** "YYYY-MM" of the month being planned (always next month for now). */
  planningMonth: string;
  /** The app-wide mode: the sheet plans that wallet's categories. */
  scope: BudgetScope;
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  /** Unassigned capacity after current commitments, before next month's plan. */
  planningCapacity: PlanAmounts;
};

/* ─── Main component ──────────────────────────────────────────────── */

export function MonthPlanSheet({
  open,
  onClose,
  onSaved,
  onCategoriesChanged,
  planningMonth,
  scope,
  categories,
  frozenCategories,
  accounts,
  planningCapacity,
}: MonthPlanSheetProps) {
  const reduceMotion = useReducedMotion();
  const currentMonth = shiftMonth(planningMonth, -1);
  const planLabel = monthName(planningMonth);

  // Saved plan for the planning month, and this month's plan + spending (for context).
  const [saved, setSaved] = useState<Map<string, number>>(new Map());
  const [currentPlanned, setCurrentPlanned] = useState<Map<string, number>>(new Map());
  const [currentSpent, setCurrentSpent] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  // Draft amounts by normalised category id; missing = the saved amount.
  const [draft, setDraft] = useState<Record<string, number>>({});
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Once the hero number scrolls away, a compact bar keeps the jar and number in view.
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [heroTarget, setHeroTarget] = useState<HTMLSpanElement | null>(null);
  const [heroHidden, setHeroHidden] = useState(false);

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
    setLoading(true);
    setLoadError("");
    const { start, end } = monthBounds(`${currentMonth}-01`);
    try {
      const [fundsRes, summaryRes] = await Promise.all([
        fetch(`/api/monthly-planning/funds?month=${planningMonth}`),
        fetch(`/api/monthly-summary?start=${start}&end=${end}`),
      ]);
      const funds = await fundsRes.json();
      const summary = await summaryRes.json();
      if (!fundsRes.ok) throw new Error(funds.error || "Couldn't load the saved plan");
      if (!summaryRes.ok) throw new Error(summary.error || "Couldn't load current commitments");
      setSaved(sumByCategory(funds.funds ?? []));
      setCurrentPlanned(sumByCategory(summary.summary?.assignedByCategory ?? []));
      setCurrentSpent(sumByCategory(summary.summary?.spentByCategory ?? []));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load the plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft({});
    setRevived([]);
    setLocallyFrozen([]);
    setHeroHidden(false);
    setCollapsed(new Set(["frozen"]));
    setSaveError("");
    void loadPlan();
  }, [open, planningMonth]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const totals: PlanAmounts = { joint: 0, anas: 0, salma: 0 };
  const catalog = new Map([...frozenCategories, ...activeCategories].map((c) => [normId(c.id), c]));
  for (const cat of catalog.values()) {
    const owner = getCategoryScope(cat, accounts);
    if (owner) totals[owner] += amountFor(cat);
  }
  const capacity = calculateMonthPlanCapacity(planningCapacity, totals, split);
  const notAssigned = capacity.pool[scope];
  const left = capacity.left[scope];
  const shortfalls = (["anas", "salma"] as const)
    .filter((partner) => capacity.left[partner] < -0.005)
    .map((partner) => `${BUDGET_SCOPE_LABELS[partner]} is short by ${fmt(Math.ceil(-capacity.left[partner]))}`);
  const capacityError = shortfalls.length ? `${shortfalls.join(" · ")}. Reduce personal or Joint allocations before saving.` : "";

  const capacityLabel = left < 0 ? "Over capacity" : "Unassigned";
  const personalRemaining = {
    anas: Math.max(0, planningCapacity.anas - totals.anas),
    salma: Math.max(0, planningCapacity.salma - totals.salma),
  };

  const jarItems = useMemo(
    () => allocationJarItems(
      scopeCategories.map((c) => ({ categoryId: c.id, icon: c.icon, amount: amountFor(c) })),
      Math.max(notAssigned, plannedTotal),
    ),
    [scopeCategories, draft, saved, notAssigned, plannedTotal], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const jarMood: Mood = left < 0 ? "worried" : plannedTotal > 0 && Math.round(left) === 0 ? "happy" : left > 0 ? "curious" : "idle";

  const setAmount = (cat: Category, value: number) =>
    setDraft((prev) => ({ ...prev, [normId(cat.id)]: Math.max(0, Math.round(value)) }));

  const copyCurrentPlan = () => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const cat of scopeCategories) {
        const value = currentPlanned.get(normId(cat.id));
        if (value && value > 0) next[normId(cat.id)] = Math.round(value);
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

  const save = async () => {
    if (!changed.length || loading || saving || freezing || loadError || capacityError) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/monthly-planning/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: planningMonth,
          allowClear: true,
          budgetItems: changed.map((c) => ({ categoryId: c.id, amount: amountFor(c), defaultAccount: c.defaultAccount ?? null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the plan");
      setSaved((prev) => {
        const next = new Map(prev);
        for (const c of changed) next.set(normId(c.id), amountFor(c));
        return next;
      });
      setDraft({});
      onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the plan");
    } finally {
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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      showHandle
      label={`Plan ${planLabel}`}
      detent="content"
      panelStyle={panelStyle}
      contentStyle={contentStyle}
    >
      <div style={innerStyle} className="planner-wrap">
        <header style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>{BUDGET_SCOPE_LABELS[scope]} budget</div>
            <h1 style={titleStyle}>Plan {planLabel}</h1>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            <XIcon size={16} />
          </button>
        </header>

        <div style={scrollAreaStyle}>
          {/* The compact bar floats over the list on a blur that thins out below it — no hard bottom edge. */}
          <ProgressiveBlur
            position="top"
            height={STICKY_BAR_H + 44}
            solidHeight={STICKY_BAR_H - 12}
            maxBlur={12}
            tint={SHEET_BG}
            visible={heroHidden}
            reduceMotion={!!reduceMotion}
          />
          <div
            aria-hidden={!heroHidden}
            style={{
              ...stickyBarStyle,
              opacity: heroHidden ? 1 : 0,
              transform: heroHidden ? "translateY(0)" : "translateY(-4px)",
              transition: reduceMotion ? "none" : "opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: heroHidden ? "auto" : "none",
            }}
          >
            <MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} size={52} style={{ margin: 0, flexShrink: 0 }} />
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={stickyLabelStyle}>{capacityLabel}</span>
              <span style={{ ...stickyAmountStyle, color: left < 0 ? "var(--danger)" : "var(--text)" }}>
                {left < 0 ? "−" : ""}
                <Money value={Math.abs(Math.round(left))} currency animated />
              </span>
            </div>
            {plannedTotal > 0 && (
              <span style={stickyPlannedStyle}>
                {fmt(Math.round(plannedTotal))} planned
              </span>
            )}
          </div>
        <div ref={setScrollRoot} style={scrollStyle}>
          {/* Hero: the jar fills with the categories you plan; the number is what's still unassigned. */}
          <section aria-label={capacityLabel} style={heroStyle}>
            {scope === "joint" ? (
              <JointFamily planningCapacity={personalRemaining}>
                <MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} style={{ marginBottom: -4 }} />
              </JointFamily>
            ) : (
              <MascotHero variant="split" scope={scope} items={jarItems} spentPct={null} remember={false} mood={jarMood} style={{ marginBottom: -4 }} />
            )}
            <span style={heroLabelStyle}>{capacityLabel}</span>
            <span ref={setHeroTarget} style={{ ...heroAmountStyle, color: left < 0 ? "var(--danger)" : "var(--text)" }}>
              {left < 0 ? "−" : ""}
              <Money value={Math.abs(Math.round(left))} currency animated />
            </span>
            {plannedTotal > 0 && (
              <span style={heroSubStyle}>
                {fmt(Math.round(plannedTotal))} planned{savedTotal !== plannedTotal ? " · not saved" : ""}
              </span>
            )}
            {scope !== "joint" && (
              <span style={heroSubStyle}>{fmt(Math.round(capacity.due[scope]))} reserved for Joint</span>
            )}
          </section>

          {loadError && (
            <Banner role="alert" tone="danger" compact title={loadError} action={<button type="button" onClick={() => void loadPlan()} style={textButtonStyle}>Retry</button>} />
          )}

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
                      <CategoryIcon icon={cat.icon} size={20} style={{ opacity: 0.5, flexShrink: 0 }} />
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
        </div>
        </div>

        <footer style={footerStyle}>
          {(saveError || capacityError) && <Banner role="alert" tone="danger" compact>{saveError || capacityError}</Banner>}
          {hasCurrentPlan && (
            <button type="button" onClick={copyCurrentPlan} disabled={loading || saving || !!freezing} style={copyLinkStyle}>
              Copy last month's plan
            </button>
          )}
          <div style={footerRowStyle} className="planner-footer-row">
            {/* A month's plan is a big commitment: slide to save, so a stray tap never does. */}
            {changed.length || saving ? (
              <SlideToConfirm label="Slide to save plan" busy={saving} busyLabel="Saving…" disabled={loading || !!freezing || !!loadError || !!capacityError} onConfirm={() => void save()} />
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
        <div style={rowIconStyle}><CategoryIcon icon={cat.icon} size={18} /></div>
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
              const next = e.target.value.replace(/[^\d+\-*/.() ]/g, "");
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

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 4,
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
  letterSpacing: 0.5,
  textTransform: "uppercase",
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
  letterSpacing: 0.6,
  textTransform: "uppercase",
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
  borderTop: "1px solid color-mix(in srgb, var(--border) 18%, transparent)",
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
