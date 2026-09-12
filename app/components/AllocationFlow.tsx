"use client";
import { ChoicePicker } from "./ChoicePicker";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Save } from "lucide-react";
import { ArrowLeftIcon, XIcon } from "./ui/icons";
import { MonthPicker } from "./DatePicker";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { BottomSheet } from "./ui/BottomSheet";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { Banner } from "./ui/Banner";
import type { Account, MonthlyPlanningSnapshot, PlanningAllocationItem } from "./app-types";
import { fmt, getLeftToAssignByScope } from "./app-utils";

export type BudgetGroupKey = "household" | "wife" | "husband" | "savings" | string;

export type AllocationGroup = {
  key: BudgetGroupKey;
  label: string;
  items: PlanningAllocationItem[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

function getPracticalStep(span: number): number {
  if (span <= 0) return 1;
  const target = span / 24;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const candidates = [1, 2, 2.5, 5, 10].map(value => value * magnitude);
  return Math.max(1, Math.round(candidates.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best)));
}

type AllocationFlowProps = {
  open: boolean;
  mode?: "sheet" | "screen";
  selectedMonth: string;
  onSelectedMonthChange?: (nextMonth: string) => void;
  onCancel: () => void;
  onComplete?: () => void;
  accounts?: Account[];
  groups: AllocationGroup[];
  isUsingFallbackData?: boolean;
  onSave?: (payload: { month: string; budgetItems: PlanningAllocationItem[]; savingsItems: PlanningAllocationItem[]; snapshot: MonthlyPlanningSnapshot }) => Promise<void>;
  // extension props (used by RebalanceSheet and other wrappers)
  poolOverride?: number;
  poolLabel?: string;
  saveButtonLabel?: string;
  requireBalanced?: boolean;
  readOnly?: boolean;
  readOnlyBanner?: ReactNode;
  headerControls?: ReactNode;
  chipsContent?: ReactNode;
  flowPreview?: ReactNode;
  title?: string;
  balancedLabel?: string;
  heroPool?: boolean;
  metaLabel?: string;
  rebalanceMode?: boolean;
};

export function AllocationFlow({
  open,
  selectedMonth,
  onSelectedMonthChange,
  onCancel,
  onComplete,
  accounts = [],
  groups,
  isUsingFallbackData = false,
  onSave,
  poolOverride,
  poolLabel = "Available",
  saveButtonLabel = "Save",
  requireBalanced = false,
  readOnly = false,
  readOnlyBanner,
  headerControls,
  chipsContent,
  flowPreview,
  title = "Set Monthly Budget",
  balancedLabel = "Fully assigned",
  mode = "sheet",
  heroPool = false,
  metaLabel = "Last month",
  rebalanceMode = false,
}: AllocationFlowProps) {
  // Spent-floor per category, snapshotted on first activation.
  // Must NOT be recomputed from activeItem.amount after edits — that shifts the
  // range input's `min` mid-drag and causes a runaway feedback loop.
  const spentFloorRef = useRef<Record<string, number>>({});
  const [activeGroup, setActiveGroup] = useState<BudgetGroupKey>(groups[0]?.key ?? "household");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(groups[0]?.items[0]?.categoryId ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset active item only when the set of group keys changes (not on every amount update)
  const groupKeysSignal = useMemo(() => groups.map((g) => g.key).join(","), [groups]);
  useEffect(() => {
    setActiveGroup(groups[0]?.key ?? "household");
    setActiveCategoryId(groups[0]?.items[0]?.categoryId ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, groupKeysSignal]);

  // Reset interaction tracking when sheet closes; also clear floor snapshots
  // so they're re-computed fresh if the sheet re-opens with new data.
  useEffect(() => {
    if (!open) {
      setHasInteracted(false);
      setDraftValue(null);
      setConfirming(false);
      spentFloorRef.current = {};
    }
  }, [open]);

  // Discard any in-progress draft when the active category changes.
  useEffect(() => { setDraftValue(null); setConfirming(false); }, [activeCategoryId]);

  const monthLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return "Selected month";
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    if (Number.isNaN(date.getTime())) return "Selected month";
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
  }, [selectedMonth]);

  const poolFromAccounts = useMemo(() => getLeftToAssignByScope(accounts).joint, [accounts]);
  const availablePool = poolOverride ?? poolFromAccounts;

  const active = groups.find((g) => g.key === activeGroup) ?? groups[0];
  const activeIndex = Math.max(0, active.items.findIndex((item) => item.categoryId === activeCategoryId));
  const activeItem = active.items[activeIndex] ?? active.items[0] ?? null;
  const allBudgetItems = useMemo(() => groups.reduce((acc, g) => acc.concat(g.items.filter((it) => g.key !== "savings")), [] as PlanningAllocationItem[]), [groups]);
  const savingsItems = useMemo(() => groups.find((g) => g.key === "savings")?.items ?? [], [groups]);
  const assignedBudget = useMemo(() => allBudgetItems.reduce((sum, item) => sum + item.amount, 0), [allBudgetItems]);
  const assignedSavings = useMemo(() => savingsItems.reduce((sum, item) => sum + item.amount, 0), [savingsItems]);
  const leftToAssign = availablePool - assignedBudget - assignedSavings;
  const snapshot: MonthlyPlanningSnapshot = { availablePool, assignedHousehold: assignedBudget, assignedSavings, leftToAssign };

  const totalCategories = allBudgetItems.length + savingsItems.length;
  const isBalanced = availablePool > 0 && leftToAssign === 0;
  const isOver = availablePool > 0 && leftToAssign < 0;
  const canSave =
    totalCategories > 0 &&
    saveState !== "saving" &&
    typeof onSave === "function" &&
    !readOnly &&
    (!requireBalanced || (isBalanced && hasInteracted));

  const activeShare = activeItem ? activeItem.amount / Math.max(1, availablePool) : 0;

  // Stable spent floor — snapshot on first access, never recompute from the
  // mutable activeItem.amount. Without this, dragging the slider increases
  // `amount`, which increases `rangeMin`, which shifts the native input's `min`
  // mid-drag, triggering another onChange → runaway feedback loop.
  const getSpentFloor = (item: PlanningAllocationItem): number => {
    if (spentFloorRef.current[item.categoryId] === undefined) {
      spentFloorRef.current[item.categoryId] = Math.max(
        0,
        item.amount - (item.available ?? item.amount),
      );
    }
    return spentFloorRef.current[item.categoryId];
  };

  // Range math
  const rangeMin = activeItem ? getSpentFloor(activeItem) : 0;
  const rangeMax = activeItem ? Math.max(rangeMin, activeItem.amount + Math.max(0, leftToAssign)) : 0;
  const rangeStops = useMemo(() => {
    const span = Math.max(0, rangeMax - rangeMin);
    if (span === 0) return [rangeMin];
    const step = getPracticalStep(span);
    const stops = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => rangeMin + (index * step));
    if (stops[stops.length - 1] !== rangeMax) stops.push(rangeMax);
    return stops;
  }, [rangeMin, rangeMax]);
  const activeStopIndex = activeItem
    ? rangeStops.reduce((best, stop, index) => Math.abs(stop - activeItem.amount) < Math.abs(rangeStops[best] - activeItem.amount) ? index : best, 0)
    : 0;
  const rangeStep = getPracticalStep(Math.max(0, rangeMax - rangeMin));
  const updateActiveAmount = (nextAmount: number) => {
    if (!activeItem) return;
    setHasInteracted(true);
    setConfirming(false);
    const minAmount = getSpentFloor(activeItem);
    const maxAmount = Math.max(minAmount, activeItem.amount + Math.max(0, leftToAssign));
    const clampedAmount = Math.min(maxAmount, Math.max(minAmount, Math.round(nextAmount)));
    active.onChange(active.items.map((item) => (item.categoryId === activeItem.categoryId ? { ...item, amount: clampedAmount } : item)));
  };

  const selectGroup = (groupKey: BudgetGroupKey) => {
    const nextGroup = groups.find((group) => group.key === groupKey);
    setActiveGroup(groupKey);
    setActiveCategoryId(nextGroup?.items[0]?.categoryId ?? "");
  };

  const stepCategory = (direction: -1 | 1) => {
    if (!active.items.length) return;
    const nextIndex = (activeIndex + direction + active.items.length) % active.items.length;
    setActiveCategoryId(active.items[nextIndex]?.categoryId ?? "");
  };

  const savePlan = async () => {
    if (!canSave || !onSave) return;
    try {
      setSaveState("saving");
      setSaveError("");
      await onSave({ month: selectedMonth, budgetItems: allBudgetItems, savingsItems, snapshot });
      setSaveState("idle");
      onComplete?.();
      onCancel();
    } catch (error: unknown) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Failed to save plan");
    }
  };

  const innerContent = (
    <>
      {mode === "screen" ? (
        <header style={screenHeaderStyle}>
          <button onClick={onCancel} aria-label="Go back" style={backButtonStyle}>
            <ArrowLeftIcon size={18} />
          </button>
          <div>
            <h2 style={sheetTitleStyle}>{title}</h2>
            {onSelectedMonthChange ? (
              <MonthPicker value={selectedMonth} aria-label="Change planning month" onChange={(event) => onSelectedMonthChange(event.target.value)} style={monthPickerButtonStyle} />
            ) : (
              <span style={monthLabelFallbackStyle}>{monthLabel}</span>
            )}
          </div>
          {!chipsContent && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {headerControls ?? <GroupPicker groups={groups} activeGroup={activeGroup} onSelect={selectGroup} />}
            </div>
          )}
        </header>
      ) : (
        <header style={sheetHeaderStyle}>
          <h2 style={sheetTitleStyle}>{title}</h2>
          <button onClick={onCancel} aria-label="Close" style={closeButtonStyle}>
            <XIcon size={14} />
          </button>
          {onSelectedMonthChange ? (
            <MonthPicker value={selectedMonth} aria-label="Change planning month" onChange={(event) => onSelectedMonthChange(event.target.value)} style={monthPickerButtonStyle} />
          ) : (
            <span style={monthLabelFallbackStyle}>{monthLabel}</span>
          )}
          {headerControls ?? <GroupPicker groups={groups} activeGroup={activeGroup} onSelect={selectGroup} />}
        </header>
      )}

      <div style={mode === "screen" ? { ...sheetScrollStyle, ...(heroPool ? { paddingTop: 8 } : {}) } : sheetScrollStyle}>
        {chipsContent && (
          <div style={chipsContentWrapStyle}>{chipsContent}</div>
        )}
        <section className="planning-balance" aria-label="Planning balance" style={{ ...balanceHeaderStyle, position: "relative", overflow: "visible" }}>
          {heroPool ? (
            <div style={heroPoolWrapStyle}>
              <span style={heroPoolLabelStyle}>{poolLabel}</span>
              <span style={heroPoolNumberStyle}>
                <Money value={availablePool} animated animateOnMount />
              </span>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
                {isBalanced ? (
                  <span key="balanced" style={{ ...balancedTextStyle, animation: "balancedIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    ✓ {balancedLabel}
                  </span>
                ) : (
                  <span key={isOver ? "over" : "under"} style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: -0.3,
                    color: isOver
                      ? "var(--danger)"
                      : "color-mix(in srgb, var(--success) 72%, var(--text2))",
                    animation: "chipIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
                  }}>
                    {isOver ? "−" : "+"}<Money value={Math.abs(Math.round(leftToAssign))} showCurrency={false} />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ ...quietAvailableRowStyle, alignItems: "flex-start" }}>
              <span style={balanceLabelStyle}>{poolLabel}</span>
              <div style={valueColumnStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={quietAvailableValueStyle}>
                    <Money value={availablePool} />
                  </span>
                  {isUsingFallbackData && !poolOverride && <span style={estimateBadgeStyle}>Est.</span>}
                </div>
                {isBalanced ? (
                  <span key="balanced" style={{ ...balancedTextStyle, animation: "balancedIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    ✓ {balancedLabel}
                  </span>
                ) : (
                  <span key={isOver ? "over" : "under"} style={{ ...deltaChipStyle(isOver), animation: "chipIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    {isOver ? "−" : "+"}<Money value={Math.abs(Math.round(leftToAssign))} />
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
        {readOnlyBanner}
        {flowPreview}

        <section className="planning-studio" aria-label="Budget allocation" style={studioStyle}>
          <div className="planning-scroll-rail planning-category-rail" style={categoryRailStyle} aria-label={`${active.label} categories`}>
            {active.items.map((item) => {
              const isActive = item.categoryId === activeItem?.categoryId;
              return (
                <button key={item.categoryId} type="button" onClick={() => setActiveCategoryId(item.categoryId)} style={{ ...(isActive ? categoryPillActiveStyle : categoryPillStyle) }} aria-pressed={isActive}>
                  <CategoryIcon icon={item.icon} size={17} style={categoryIconStyle(isActive)} />
                  <span style={categoryNameStyle}>{item.name}</span>
                </button>
              );
            })}
          </div>

          {!activeItem && <div style={emptyStyle}>No categories found for {active.label}.</div>}
        </section>
      </div>

      {activeItem && (
        <div className={`planning-stack${isBalanced ? " planning-stack--balanced" : isOver ? " planning-stack--over" : ""}`} style={stackedUnitStyle}>
          <div className="planning-editor" style={editorStyle}>
            <div key={activeItem.categoryId} className="planning-category-enter planning-amount-canvas" style={amountCanvasStyle}>
              <span style={amountCurrencyBigStyle}>MAD</span>
              <label style={amountEditorStyle}>
                <span style={srOnlyStyle}>Planned amount for {activeItem.name}</span>
                {draftValue === null && (
                  <AnimatedCounter value={activeItem.amount} separator="." style={{ ...amountCounterStyle, color: isOver ? "var(--danger)" : "var(--text2)" }} />
                )}
                <input
                  className="planning-amount-input"
                  type="text"
                  readOnly={readOnly}
                  value={draftValue ?? String(activeItem.amount)}
                  onFocus={() => setDraftValue(String(activeItem.amount))}
                  onChange={(event) => setDraftValue(event.target.value)}
                  onBlur={() => {
                    if (draftValue !== null) {
                      updateActiveAmount(parseFloat(draftValue.replace(/[^0-9.]/g, "")) || 0);
                      setDraftValue(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      updateActiveAmount(parseFloat((draftValue ?? "").replace(/[^0-9.]/g, "")) || 0);
                      setDraftValue(null);
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      setDraftValue(null);
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={`Planned amount for ${activeItem.name}`}
                  style={{ ...amountInputBigStyle(isOver), ...(draftValue === null ? hiddenAmountInputStyle : null), ...(readOnly ? { opacity: 0.7 } : null) }}
                />
              </label>
              <div style={metaRowStyle}>
                <span>{metaLabel} <Money value={activeItem.lastMonthSpent ?? 0} showCurrency={false} /></span>
                <span>Spent <Money value={activeItem.spent ?? getSpentFloor(activeItem)} showCurrency={false} /></span>
              </div>
            </div>
          </div>

          <div aria-label="Budget control" style={slimBarPanelStyle}>
            <div className="planning-step-control" style={stepControlStyle}>
              <div style={stepTicksStyle} aria-hidden="true">
                {rangeStops.map((stop, index) => (
                  <span key={`${stop}-${index}`} style={stepTickStyle(index === activeStopIndex, index < activeStopIndex)} />
                ))}
              </div>
              <input
                className="planning-dial-range"
                type="range"
                min={0}
                max={Math.max(0, rangeStops.length - 1)}
                step={1}
                value={activeStopIndex}
                disabled={readOnly}
                onChange={(event) => updateActiveAmount(rangeStops[Number(event.target.value)] ?? rangeMin)}
                aria-label={`Adjust planned amount for ${activeItem.name}`}
                aria-valuetext={`${fmt(activeItem.amount)} MAD; ${fmt(rangeStep)} MAD per step`}
                style={steppedRangeStyle}
              />
            </div>
            {saveError && <Banner role="alert" tone="danger" compact>{saveError}</Banner>}
            {confirming && (
              <div role="status" style={confirmationStyle}>
                <span>
                  <strong style={confirmationTitleStyle}>Apply this rebalance?</strong>
                  <span style={confirmationCopyStyle}>{isBalanced ? "Every available dirham stays assigned." : `${fmt(Math.abs(Math.round(leftToAssign)))} MAD will remain unassigned.`}</span>
                </span>
                <button type="button" onClick={() => setConfirming(false)} style={confirmationBackStyle}>Back</button>
              </div>
            )}
            <button type="button" onClick={() => confirming ? savePlan() : setConfirming(true)} disabled={!canSave} className={isBalanced ? "planning-save--balanced" : undefined} style={{ ...saveButtonStyle, opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "not-allowed" }}>
              <Save size={15} />
              {saveState === "saving" ? "Saving..." : confirming ? "Confirm" : saveButtonLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (mode === "screen") {
    if (!open || !mounted) return null;
    return createPortal(
      <div style={screenWrapStyle}>
        <div style={screenInnerStyle}>
          {innerContent}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <BottomSheet open={open} onClose={onCancel} showHandle label={title} detent="content" maxHeight="calc(100dvh - max(env(safe-area-inset-top, 0px), 20px))" panelStyle={sheetPanelStyle} contentStyle={sheetContentStyle} zIndex={80}>
      {innerContent}
    </BottomSheet>
  );
}

const screenWrapStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "color-mix(in srgb, var(--bg) 96%, var(--surface))",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  paddingTop: "env(safe-area-inset-top, 0px)",
};
const screenInnerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  overflowX: "hidden",
  background: "color-mix(in srgb, var(--bg) 96%, var(--surface))",
  borderRadius: "24px 24px 0 0",
};



// GroupPicker and styles (copied/encapsulated for reusability)
function GroupPicker({ groups, activeGroup, onSelect }: { groups: AllocationGroup[]; activeGroup: BudgetGroupKey; onSelect: (key: BudgetGroupKey) => void; }) {
  return <ChoicePicker aria-label="Budget group" value={activeGroup} onChange={event => onSelect(event.target.value as BudgetGroupKey)}>
    {groups.map(group => <option key={group.key} value={group.key}>{group.label} ({group.items.length})</option>)}
  </ChoicePicker>;
}

const gpColor = (key: BudgetGroupKey): string => {
  if (key === "wife") return "var(--partner-wife-strong)";
  if (key === "husband") return "var(--partner-husband-strong)";
  return "var(--text)";
};

// --- styles (kept local to component) ---
const gpWrapStyle: CSSProperties = { position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0, overflow: "visible" };
const gpTriggerStyle: CSSProperties = { minHeight: 44, padding: "0 4px", border: "none", background: "transparent", color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, justifySelf: "end" };
const gpLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 600 };
const gpChevronStyle: CSSProperties = { pointerEvents: "none", color: "var(--muted)", transition: "transform 0.16s ease" };
const gpMenuStyle: CSSProperties = { width: 192, padding: 6, borderRadius: 16, border: "1px solid color-mix(in srgb, var(--border2) 60%, transparent)", background: "var(--surface)", boxShadow: "0 18px 36px color-mix(in srgb, var(--ink-strong) 14%, transparent), inset 0 1px 0 color-mix(in srgb, white 55%, transparent)", zIndex: 90, display: "grid", gap: 3 };
const gpOptionStyle: CSSProperties = { minHeight: 44, width: "100%", border: "none", borderRadius: 12, background: "transparent", color: "var(--text2)", cursor: "pointer", display: "grid", gridTemplateColumns: "8px 1fr auto", alignItems: "center", gap: 9, padding: "0 10px", textAlign: "left" };
const gpOptionActiveStyle: CSSProperties = { background: "color-mix(in srgb, var(--surface2) 70%, var(--surface))" };
const gpDotStyle: CSSProperties = { width: 7, height: 7, borderRadius: 999 };
const gpOptionTextStyle: CSSProperties = { fontSize: 13, fontWeight: 700 };
const gpCountStyle: CSSProperties = { fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)" };

const sheetPanelStyle: CSSProperties = { background: "var(--surface)", borderRadius: "24px 24px 0 0", boxShadow: "var(--elevation-float)" };
const sheetContentStyle: CSSProperties = { overflow: "hidden", display: "flex", flexDirection: "column" };
const sheetHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", rowGap: 10, columnGap: 12, padding: "16px 20px 14px", flexShrink: 0 };
const screenHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "44px 1fr auto", alignItems: "center", gap: 8, padding: "14px 16px 12px", flexShrink: 0 };
const backButtonStyle: CSSProperties = { width: 44, height: 44, border: "none", background: "transparent", color: "var(--text2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const sheetTitleStyle: CSSProperties = { fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: "var(--text2)" };
const sheetScrollStyle: CSSProperties = { overflowY: "auto", overflowX: "hidden", padding: "8px 12px 12px", display: "grid", alignContent: "start", gap: 12 };
const monthPickerButtonStyle: CSSProperties = { minHeight: 44, padding: "0 4px", border: "none", background: "transparent", color: "var(--text2)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" };
const monthLabelFallbackStyle: CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", color: "var(--text2)", fontSize: 13, fontWeight: 600 };
const closeButtonStyle: CSSProperties = { width: 44, height: 44, border: "none", background: "transparent", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, justifySelf: "end" };
const balanceHeaderStyle: CSSProperties = { display: "grid", gap: 3 };
const quietAvailableRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const valueColumnStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 };
const balanceLabelStyle: CSSProperties = { color: "var(--muted)", fontSize: 12, fontWeight: 600 };
const quietAvailableValueStyle: CSSProperties = { color: "var(--text2)", fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', letterSpacing: -0.5 };
const estimateBadgeStyle: CSSProperties = { alignSelf: "center", borderRadius: 999, padding: "5px 9px", background: "color-mix(in srgb, var(--warning-dim) 70%, var(--surface))", color: "color-mix(in srgb, var(--warning) 82%, black)", fontSize: 12, fontWeight: 750 };
const balancedTextStyle: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0.1, color: "color-mix(in srgb, var(--success) 62%, var(--text2))" };
const deltaChipStyle = (isOver: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 2,
  fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
  color: isOver
    ? "color-mix(in srgb, var(--danger) 78%, var(--text2))"
    : "color-mix(in srgb, var(--success) 72%, var(--text2))",
});
const studioStyle: CSSProperties = { display: "grid", gap: 8 };
const categoryRailStyle: CSSProperties = { display: "flex", gap: 8, overflowX: "auto", padding: "0 4px 4px", alignItems: "center" };
const categoryPillStyle: CSSProperties = { flex: "0 0 auto", maxWidth: 148, minHeight: 44, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)", background: "var(--surface)", color: "var(--text2)", padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", boxShadow: "none", transition: "background-color var(--motion-standard) ease, color var(--motion-standard) ease" };
const categoryPillActiveStyle: CSSProperties = { ...categoryPillStyle, borderColor: "transparent", background: "color-mix(in srgb, var(--accent) 42%, var(--surface))", color: "var(--accent-ink)" };
const categoryIconStyle = (isActive: boolean): CSSProperties => ({ color: isActive ? "var(--accent-ink)" : "var(--text2)", flexShrink: 0 });
const categoryNameStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 750 };
const stackedUnitStyle: CSSProperties = { overflow: "hidden", flex: "1 1 auto", minHeight: 0, marginTop: 16, background: "var(--surface)", boxShadow: "none", display: "flex", flexDirection: "column" };
const editorStyle: CSSProperties = { display: "grid" };
const amountCanvasStyle: CSSProperties = { position: "relative", display: "grid", alignContent: "center", gridTemplateRows: "minmax(68px, auto) auto", gap: 8, minHeight: 132, padding: "14px 10px 12px", borderRadius: 0, background: "var(--surface)", borderBottom: "1px solid color-mix(in srgb, var(--border) 14%, transparent)", overflow: "hidden" };
const amountCurrencyBigStyle: CSSProperties = { position: "absolute", left: 18, top: 18, color: "color-mix(in srgb, var(--muted) 24%, transparent)", fontFamily: "var(--font-body)", fontSize: 22, lineHeight: 1, fontWeight: 600, opacity: 0.6, zIndex: 1 };
const amountEditorStyle: CSSProperties = { position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0, minHeight: 68 };
const amountCounterStyle: CSSProperties = { position: "absolute", inset: 0, justifyContent: "center", pointerEvents: "none", fontFamily: "var(--font-body)", fontSize: "clamp(3rem, 16vw, 4.2rem)", lineHeight: 0.92, fontWeight: 500, letterSpacing: -2, zIndex: 3 };
const hiddenAmountInputStyle: CSSProperties = { color: "transparent", caretColor: "transparent" };
const srOnlyStyle: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };
const amountInputBigStyle = (isOver: boolean): CSSProperties => ({ width: "100%", minWidth: 0, maxWidth: "100vw", border: "none", background: "transparent", color: isOver ? "var(--danger)" : "var(--text2)", textAlign: "center", fontFamily: "var(--font-body)", fontSize: "clamp(3rem, 16vw, 4.2rem)", lineHeight: 0.92, fontWeight: 500, letterSpacing: -2, outline: "none", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', zIndex: 2, padding: 0, margin: 0, backgroundClip: "text", transition: "color 0.35s cubic-bezier(0.22, 1, 0.36, 1)" });
const metaRowStyle: CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, color: "var(--text2)", fontSize: 12, fontFamily: "var(--font-body)", opacity: 0.5 };
const stepControlStyle: CSSProperties = { position: "relative", display: "grid", padding: "2px 0", touchAction: "none" };
const stepTicksStyle: CSSProperties = { height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" };
const stepTickStyle = (active: boolean, passed: boolean): CSSProperties => ({ width: active ? 4 : 3, height: 34, borderRadius: 999, background: active ? "var(--accent)" : passed ? "color-mix(in srgb, var(--accent) 48%, var(--text2))" : "var(--surface2)", transform: `scaleY(${active ? 1 : 0.65})`, transformOrigin: "center", transition: "transform 150ms var(--ease-standard), background-color 150ms ease" });
const steppedRangeStyle: CSSProperties = { position: "absolute", inset: "0 0 auto", width: "100%", height: 44, margin: 0, opacity: 0, cursor: "ew-resize", touchAction: "none" };
const confirmationStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text2)" };
const confirmationTitleStyle: CSSProperties = { display: "block", fontSize: 13, lineHeight: 1.2 };
const confirmationCopyStyle: CSSProperties = { display: "block", marginTop: 3, fontSize: 11, lineHeight: 1.35, color: "var(--muted)" };
const confirmationBackStyle: CSSProperties = { minWidth: 44, minHeight: 44, padding: "0 10px", border: 0, borderRadius: "var(--radius-control)", background: "var(--surface)", color: "var(--text2)", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const emptyStyle: CSSProperties = { minHeight: 220, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 };
const dialPanelStyle = (isOver: boolean, isBalanced: boolean): CSSProperties => ({ display: "grid", gap: 14, padding: `20px 18px calc(16px + env(safe-area-inset-bottom, 0px))`, borderRadius: "20px 0 0 0", background: isOver ? "color-mix(in srgb, var(--danger) 14%, var(--surface))" : isBalanced ? "color-mix(in srgb, var(--accent) 58%, var(--surface))" : "color-mix(in srgb, var(--accent) 34%, var(--surface))", color: isOver ? "var(--danger)" : "var(--accent-ink)", boxShadow: "inset 0 1px 0 color-mix(in srgb, white 42%, transparent)", transition: "background var(--motion-slow) var(--ease-standard)" });
const dialCopyStyle: CSSProperties = { display: "grid", gap: 4 };
const dialStatusStyle: CSSProperties = { fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.78 };
const dialTitleStyle: CSSProperties = { fontSize: 15, lineHeight: 1.2, fontWeight: 850 };
const dialBodyStyle: CSSProperties = { maxWidth: 260, fontSize: 12, lineHeight: 1.35, opacity: 0.78 };
const rangeWrapStyle: CSSProperties = { display: "grid", gap: 4 };
const slimBarPanelStyle: CSSProperties = { display: "flex", flex: "1 1 auto", minHeight: 0, flexDirection: "column", gap: 12, padding: `14px 18px calc(12px + env(safe-area-inset-bottom, 0px))`, background: "var(--surface)", borderTop: "1px solid color-mix(in srgb, var(--border) 18%, transparent)", boxShadow: "none" };
const saveButtonStyle: CSSProperties = { width: "100%", marginTop: "auto", minHeight: 52, borderRadius: 16, border: "none", background: "var(--accent)", color: "var(--accent-ink)", padding: "0 20px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 800, boxShadow: "none" };

// ── Chips content wrap ────────────────────────────────────────────────────────
const chipsContentWrapStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  paddingBottom: 4,
};

// ── Hero pool styles ──────────────────────────────────────────────────────────
const heroPoolWrapStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  textAlign: "center",
  padding: "12px 0 16px",
};
const heroPoolLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};
const heroPoolNumberStyle: CSSProperties = {
  fontSize: "clamp(52px, 14vw, 80px)",
  fontWeight: 400,
  lineHeight: 0.9,
  letterSpacing: "-0.022em",
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
};
