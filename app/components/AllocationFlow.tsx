"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Save } from "lucide-react";
import { CalendarIcon, XIcon } from "./ui/icons";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { BottomSheet } from "./ui/BottomSheet";
import type { Account, MonthlyPlanningSnapshot, PlanningAllocationItem } from "./app-types";
import { getLeftToAssignByScope } from "./app-utils";

export type BudgetGroupKey = "household" | "wife" | "husband" | "savings" | string;

export type AllocationGroup = {
  key: BudgetGroupKey;
  label: string;
  items: PlanningAllocationItem[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

type AllocationFlowProps = {
  open: boolean;
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
  title?: string;
  balancedLabel?: string;
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
  title = "Set Monthly Budget",
  balancedLabel = "Fully assigned",
}: AllocationFlowProps) {
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<BudgetGroupKey>(groups[0]?.key ?? "household");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(groups[0]?.items[0]?.categoryId ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const wasBalancedRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  const [burstKey, setBurstKey] = useState(0);

  // Reset active item only when the set of group keys changes (not on every amount update)
  const groupKeysSignal = useMemo(() => groups.map((g) => g.key).join(","), [groups]);
  useEffect(() => {
    setActiveGroup(groups[0]?.key ?? "household");
    setActiveCategoryId(groups[0]?.items[0]?.categoryId ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, groupKeysSignal]);

  // Reset interaction tracking when sheet closes
  useEffect(() => {
    if (!open) {
      setHasInteracted(false);
      isFirstRenderRef.current = true;
    }
  }, [open]);

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

  // Burst animation when balance is first achieved after user interaction
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      wasBalancedRef.current = isBalanced;
      return;
    }
    if (isBalanced && !wasBalancedRef.current) setBurstKey((k) => k + 1);
    wasBalancedRef.current = isBalanced;
  }, [isBalanced]);
  const activeShare = activeItem ? activeItem.amount / Math.max(1, availablePool) : 0;

  // Range math
  const rangeMin = activeItem ? Math.max(0, activeItem.amount - (activeItem.available ?? activeItem.amount)) : 0;
  const rangeMax = activeItem ? Math.max(rangeMin, activeItem.amount + Math.max(0, leftToAssign)) : 0;
  const rangeFill = rangeMax > rangeMin ? Math.max(0, Math.min(100, ((activeItem?.amount ?? 0) - rangeMin) / (rangeMax - rangeMin) * 100)) : 0;
  const fillTick = Math.round(rangeFill * 22 / 100);

  const updateActiveAmount = (nextAmount: number) => {
    if (!activeItem) return;
    setHasInteracted(true);
    const minAmount = Math.max(0, activeItem.amount - (activeItem.available ?? activeItem.amount));
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

  return (
    <BottomSheet open={open} onClose={onCancel} showHandle label="Set monthly budget" detent="content" maxHeight="calc(100dvh - max(env(safe-area-inset-top, 0px), 20px))" panelStyle={sheetPanelStyle} contentStyle={sheetContentStyle} zIndex={80}>
      {onSelectedMonthChange && (
        <input
          ref={monthInputRef}
          type="month"
          value={selectedMonth}
          onChange={(event) => onSelectedMonthChange(event.target.value)}
          aria-label="Selected planning month"
          style={hiddenMonthInputStyle}
          tabIndex={-1}
        />
      )}

      <header style={sheetHeaderStyle}>
        <h2 style={sheetTitleStyle}>{title}</h2>
        <button onClick={onCancel} aria-label="Close planning" style={closeButtonStyle}>
          <XIcon size={14} />
        </button>
        {onSelectedMonthChange ? (
          <button
            type="button"
            aria-label="Change planning month"
            onClick={() => {
              const input = monthInputRef.current;
              if (!input) return;
              if ("showPicker" in HTMLInputElement.prototype) input.showPicker();
              else input.click();
            }}
            style={monthPickerButtonStyle}
          >
            <CalendarIcon />
            <span>{monthLabel}</span>
          </button>
        ) : (
          <span style={monthLabelFallbackStyle}>{monthLabel}</span>
        )}
        {headerControls ?? <GroupPicker groups={groups} activeGroup={activeGroup} onSelect={selectGroup} />}
      </header>

      <div style={sheetScrollStyle}>
        <section className="planning-balance" aria-label="Planning balance" style={{ ...balanceHeaderStyle, position: "relative", overflow: "visible" }}>
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
                <span key={isOver ? "over" : "under"} style={{ ...deltaChipStyle(isOver), animation: "chipIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                  {isOver ? "−" : "+"}<Money value={Math.abs(Math.round(leftToAssign))} />
                </span>
              )}
            </div>
          </div>
          {burstKey > 0 && <BalancedBurst key={burstKey} />}
        </section>
        {readOnlyBanner}

        <section className="planning-studio" aria-label="Budget allocation" style={studioStyle}>
          <div className="planning-scroll-rail planning-category-rail" style={categoryRailStyle} aria-label={`${active.label} categories`}>
            {active.items.map((item) => {
              const isActive = item.categoryId === activeItem?.categoryId;
              return (
                <button key={item.categoryId} type="button" onClick={() => setActiveCategoryId(item.categoryId)} style={{ ...(isActive ? categoryPillActiveStyle : categoryPillStyle) }} aria-pressed={isActive}>
                  <CategoryIcon icon={item.icon} size={isActive ? 17 : 18} style={categoryIconStyle(isActive)} />
                  {isActive && (
                    <>
                      <span style={categoryNameStyle}>{item.name}</span>
                      <strong className="planning-category-amount" style={categoryAmountStyle}>
                        <Money value={item.amount} />
                      </strong>
                    </>
                  )}
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
              <CategoryIcon icon={activeItem.icon} size={16} style={amountCornerIconStyle} />
              <label style={amountEditorStyle}>
                <span style={srOnlyStyle}>Planned amount for {activeItem.name}</span>
                <input
                  className="planning-amount-input"
                  type="text"
                  inputMode="decimal"
                  readOnly={readOnly}
                  value={String(activeItem.amount)}
                  onChange={(event) => {
                    const numericValue = Number(event.target.value.replace(/[^0-9.]/g, "")) || 0;
                    updateActiveAmount(numericValue);
                  }}
                  aria-label={`Planned amount for ${activeItem.name}`}
                  style={{ ...amountInputBigStyle(isOver), ...(readOnly ? { opacity: 0.7 } : null) }}
                />
              </label>
              <div style={metaRowStyle}>
                <span>Last month <Money value={activeItem.lastMonthSpent ?? 0} /></span>
                <span>Spent <Money value={Math.max(0, activeItem.amount - (activeItem.available ?? activeItem.amount))} /></span>
              </div>
            </div>
          </div>

          <section className="planning-dial-panel" aria-label="Budget control" style={dialPanelStyle(isOver, isBalanced)}>
            <div key={`${activeItem?.categoryId ?? "empty"}-${isBalanced ? "balanced" : isOver ? "over" : "normal"}`} className="planning-dial-copy" style={dialCopyStyle}>
              <span style={dialStatusStyle}>{isOver ? "Over" : isBalanced ? "Balanced" : "Normal"}</span>
              <strong style={dialTitleStyle}>{isOver ? "Pull this month back into range" : isBalanced ? "Every dirham has a job" : activeShare >= 0.28 ? "That's a lot" : activeShare <= 0.04 ? "Small but covered" : "Looks normal"}</strong>
              <span style={dialBodyStyle}>{isOver ? "Reduce this category or move money from another one." : isBalanced ? "You can save the plan or fine tune a category." : activeShare >= 0.28 ? `Sometimes, you can spend big on ${activeItem?.name.toLowerCase() ?? "this category"}.` : "Adjust until the category feels right."}</span>
            </div>
            <div style={rangeWrapStyle}>
              <div style={tickRailStyle} aria-hidden="true">
                {Array.from({ length: 23 }).map((_, index) => {
                  const played = index <= fillTick;
                  const isMajor = index % 5 === 0;
                  const isMid = !isMajor && index % 2 === 0;
                  return (
                    <span
                      key={index}
                      style={{
                        ...tickStyle,
                        height: isMajor ? 18 : isMid ? 10 : 5,
                        background: played ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                        opacity: played
                          ? (isMajor ? 1 : isMid ? 0.84 : 0.6)
                          : (isMajor ? 0.60 : isMid ? 0.40 : 0.20),
                      }}
                    />
                  );
                })}
              </div>
              <input
                className="planning-dial-range"
                type="range"
                min={rangeMin}
                max={rangeMax}
                step={10}
                value={activeItem.amount}
                disabled={readOnly}
                onChange={(event) => updateActiveAmount(Number(event.target.value))}
                aria-label={`Adjust planned amount for ${activeItem.name}`}
                style={{ ...rangeStyle, "--range-fill": `${rangeFill.toFixed(1)}%`, ...(readOnly ? { opacity: 0.5 } : null) } as CSSProperties}
              />
            </div>
            {saveError && <div style={saveErrorStyle}>{saveError}</div>}
            <button type="button" onClick={savePlan} disabled={!canSave} className={isBalanced ? "planning-save--balanced" : undefined} style={{ ...saveButtonStyle, opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "not-allowed" }}>
              <Save size={15} />
              {saveState === "saving" ? "Saving..." : saveButtonLabel}
            </button>
          </section>
        </div>
      )}
    </BottomSheet>
  );
}

// ── Balanced burst ────────────────────────────────────────────────────────────
type BurstStyleVars = CSSProperties & { "--x": string; "--y": string; "--d": string };

function BalancedBurst() {
  const PARTICLES: { x: number; y: number; d: number; size: number }[] = [
    { x: 0, y: -36, d: 0, size: 10 }, { x: 28, y: -24, d: 55, size: 8 },
    { x: 36, y: 4, d: 25, size: 10 }, { x: 20, y: 30, d: 75, size: 7 },
    { x: -28, y: -24, d: 15, size: 8 }, { x: -36, y: 4, d: 60, size: 10 },
    { x: -16, y: 32, d: 40, size: 7 }, { x: 10, y: -44, d: 35, size: 6 },
  ];
  return (
    <>
      {PARTICLES.map((p, i) => (
        <span key={i} className="save-burst" style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--d": `${p.d}ms`, color: "var(--accent)", fontSize: p.size } as BurstStyleVars}>✦</span>
      ))}
    </>
  );
}

// GroupPicker and styles (copied/encapsulated for reusability)
function GroupPicker({ groups, activeGroup, onSelect }: { groups: AllocationGroup[]; activeGroup: BudgetGroupKey; onSelect: (key: BudgetGroupKey) => void; }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = groups.find((g) => g.key === activeGroup) ?? groups[0];

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const menu = (
    <div ref={menuRef} role="listbox" aria-label="Budget group" className="view-picker__menu" style={{ ...gpMenuStyle, position: "fixed", top: menuPos.top, right: menuPos.right, left: "auto" }}>
      {groups.map((group) => {
        const isActive = group.key === activeGroup;
        return (
          <button key={group.key} type="button" role="option" aria-selected={isActive} className={`view-picker__option${isActive ? " view-picker__option--active" : ""}`} onClick={() => { onSelect(group.key); setOpen(false); }} style={{ ...gpOptionStyle, ...(isActive ? gpOptionActiveStyle : null) }}>
            <span style={{ ...gpDotStyle, background: gpColor(group.key) }} />
            <span style={gpOptionTextStyle}>{group.label}</span>
            <span style={gpCountStyle}>{group.items.length}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="view-picker" style={gpWrapStyle}>
      <button ref={triggerRef} type="button" className="view-picker__trigger" aria-haspopup="listbox" aria-expanded={open} aria-label="Budget group" onClick={handleToggle} style={gpTriggerStyle}>
        <span style={gpLabelStyle}>{active.label}</span>
        <ChevronDown size={12} aria-hidden="true" style={{ ...gpChevronStyle, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {mounted && open && createPortal(menu, document.body)}
    </div>
  );
}

const gpColor = (key: BudgetGroupKey): string => {
  if (key === "wife") return "var(--partner-wife-strong)";
  if (key === "husband") return "var(--partner-husband-strong)";
  return "var(--text)";
};

// --- styles (kept local to component) ---
const gpWrapStyle: CSSProperties = { position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0, overflow: "visible" };
const gpTriggerStyle: CSSProperties = { minHeight: 28, padding: 0, border: "none", background: "transparent", color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, justifySelf: "end" };
const gpLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 600 };
const gpChevronStyle: CSSProperties = { pointerEvents: "none", color: "var(--muted)", transition: "transform 0.16s ease" };
const gpMenuStyle: CSSProperties = { width: 192, padding: 6, borderRadius: 16, border: "1px solid color-mix(in srgb, var(--border2) 60%, transparent)", background: "var(--surface)", boxShadow: "0 18px 36px color-mix(in srgb, var(--ink-strong) 14%, transparent), inset 0 1px 0 color-mix(in srgb, white 55%, transparent)", zIndex: 90, display: "grid", gap: 3 };
const gpOptionStyle: CSSProperties = { minHeight: 44, width: "100%", border: "none", borderRadius: 12, background: "transparent", color: "var(--text)", cursor: "pointer", display: "grid", gridTemplateColumns: "8px 1fr auto", alignItems: "center", gap: 9, padding: "0 10px", textAlign: "left" };
const gpOptionActiveStyle: CSSProperties = { background: "color-mix(in srgb, var(--surface2) 70%, white)" };
const gpDotStyle: CSSProperties = { width: 7, height: 7, borderRadius: 999 };
const gpOptionTextStyle: CSSProperties = { fontSize: 13, fontWeight: 700 };
const gpCountStyle: CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted)" };

const sheetPanelStyle: CSSProperties = { background: "color-mix(in srgb, var(--bg) 96%, white)", borderRadius: "24px 24px 0 0" };
const sheetContentStyle: CSSProperties = { overflow: "hidden", display: "flex", flexDirection: "column" };
const sheetHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", rowGap: 10, columnGap: 12, padding: "16px 20px 14px", flexShrink: 0 };
const sheetTitleStyle: CSSProperties = { fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: "var(--text)" };
const sheetScrollStyle: CSSProperties = { overflowY: "auto", overflowX: "hidden", padding: "4px 12px 8px", display: "grid", gap: 8 };
const monthPickerButtonStyle: CSSProperties = { minHeight: 28, padding: 0, border: "none", background: "transparent", color: "var(--text2)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" };
const monthLabelFallbackStyle: CSSProperties = { minHeight: 28, display: "inline-flex", alignItems: "center", color: "var(--text2)", fontSize: 13, fontWeight: 600 };
const closeButtonStyle: CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)", background: "color-mix(in srgb, var(--surface2) 70%, transparent)", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, justifySelf: "end" };
const hiddenMonthInputStyle: CSSProperties = { position: "absolute", pointerEvents: "none", opacity: 0, width: 0, height: 0 };
const balanceHeaderStyle: CSSProperties = { display: "grid", gap: 3 };
const quietAvailableRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const valueColumnStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 };
const balanceLabelStyle: CSSProperties = { color: "var(--muted)", fontSize: 12, fontWeight: 600 };
const quietAvailableValueStyle: CSSProperties = { color: "var(--text)", fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', letterSpacing: -0.5 };
const estimateBadgeStyle: CSSProperties = { alignSelf: "center", borderRadius: 999, padding: "5px 9px", background: "color-mix(in srgb, var(--warning-dim) 70%, white)", color: "color-mix(in srgb, var(--warning) 82%, black)", fontSize: 11, fontWeight: 750 };
const balancedTextStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: "color-mix(in srgb, var(--success) 62%, var(--text2))" };
const deltaChipStyle = (isOver: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 2,
  padding: "2px 7px", borderRadius: 999,
  fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace",
  background: isOver
    ? "color-mix(in srgb, var(--danger) 10%, transparent)"
    : "color-mix(in srgb, var(--success) 10%, transparent)",
  color: isOver
    ? "color-mix(in srgb, var(--danger) 78%, var(--text2))"
    : "color-mix(in srgb, var(--success) 72%, var(--text2))",
  border: isOver
    ? "1px solid color-mix(in srgb, var(--danger) 18%, transparent)"
    : "1px solid color-mix(in srgb, var(--success) 18%, transparent)",
});
const studioStyle: CSSProperties = { display: "grid", gap: 8 };
const categoryRailStyle: CSSProperties = { display: "flex", gap: 8, overflowX: "auto", padding: "0 4px 4px", alignItems: "center" };
const categoryPillStyle: CSSProperties = { flex: "0 0 40px", width: 40, minHeight: 40, borderRadius: 16, border: "1px solid color-mix(in srgb, var(--border) 32%, transparent)", background: "color-mix(in srgb, var(--surface) 90%, white)", color: "var(--text)", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 16px color-mix(in srgb, var(--ink-strong) 4%, transparent)", transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.22s ease" };
const categoryPillActiveStyle: CSSProperties = { flex: "0 0 140px", minHeight: 54, borderRadius: 18, border: "1px solid transparent", background: "linear-gradient(145deg, #39dec7, color-mix(in srgb, #39dec7 70%, var(--accent)))", color: "var(--accent-ink)", padding: "8px 10px", display: "grid", gridTemplateColumns: "30px minmax(0, 1fr)", gridTemplateRows: "auto auto", alignItems: "center", gap: "2px 8px", textAlign: "left", cursor: "pointer", boxShadow: "0 14px 26px color-mix(in srgb, #39dec7 28%, transparent)", animation: "categorySelectIn 0.24s cubic-bezier(0.22, 1, 0.36, 1) both" };
const categoryIconStyle = (isActive: boolean): CSSProperties => ({ gridColumn: "1 / 2", gridRow: "1 / 3", width: isActive ? 30 : 34, height: isActive ? 30 : 34, borderRadius: isActive ? 10 : 999, background: isActive ? "color-mix(in srgb, white 30%, transparent)" : "color-mix(in srgb, var(--accent-dim) 48%, white)", display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "var(--accent-ink)" : "color-mix(in srgb, var(--accent-ink) 78%, var(--text))" });
const categoryNameStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 750 };
const categoryAmountStyle: CSSProperties = { fontSize: 15, lineHeight: 1, fontWeight: 800, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' };
const stackedUnitStyle: CSSProperties = { borderRadius: "24px 0 0 0", overflow: "hidden", flexShrink: 0, background: "var(--surface)" };
const editorStyle: CSSProperties = { display: "grid" };
const amountCanvasStyle: CSSProperties = { position: "relative", display: "grid", alignContent: "center", gap: 6, minHeight: 120, padding: "12px 10px 10px", borderRadius: 0, background: "var(--surface)", borderBottom: "1px solid color-mix(in srgb, var(--border) 14%, transparent)", overflow: "hidden" };
const amountCurrencyBigStyle: CSSProperties = { position: "absolute", left: 18, top: 18, color: "color-mix(in srgb, var(--muted) 24%, transparent)", fontFamily: "'DM Mono', monospace", fontSize: 22, lineHeight: 1, fontWeight: 600, opacity: 0.6, zIndex: 1 };
const amountCornerIconStyle: CSSProperties = { position: "absolute", right: 18, top: 30, width: 18, height: 18, borderRadius: 6, background: "color-mix(in srgb, var(--accent) 18%, var(--surface2))", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" };
const amountEditorStyle: CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 };
const srOnlyStyle: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };
const amountInputBigStyle = (isOver: boolean): CSSProperties => ({ width: "100%", minWidth: 0, maxWidth: "100vw", border: "none", background: "transparent", color: isOver ? "var(--danger)" : "var(--text)", textAlign: "center", fontFamily: "var(--font-body)", fontSize: "clamp(3rem, 16vw, 4.2rem)", lineHeight: 0.88, fontWeight: 950, letterSpacing: -3, outline: "none", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', zIndex: 2, padding: 0, margin: 0, backgroundClip: "text", transition: "color 0.35s cubic-bezier(0.22, 1, 0.36, 1)" });
const metaRowStyle: CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, color: "var(--text2)", fontSize: 10, fontFamily: "'DM Mono', monospace", opacity: 0.5 };
const emptyStyle: CSSProperties = { minHeight: 220, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 };
const dialPanelStyle = (isOver: boolean, isBalanced: boolean): CSSProperties => ({ display: "grid", gap: 14, padding: `20px 18px calc(16px + env(safe-area-inset-bottom, 0px))`, borderRadius: "20px 0 0 0", background: isOver ? "linear-gradient(155deg, color-mix(in srgb, var(--danger) 86%, #5c2f3a), color-mix(in srgb, var(--danger) 62%, #31212a))" : isBalanced ? "linear-gradient(155deg, #9fe870, color-mix(in srgb, #9fe870 68%, #1e4a0d))" : "linear-gradient(155deg, var(--accent), color-mix(in srgb, var(--accent) 76%, #4e3df1))", color: "var(--accent-ink)", transition: "background 0.45s cubic-bezier(0.22, 1, 0.36, 1)" });
const dialCopyStyle: CSSProperties = { display: "grid", gap: 4 };
const dialStatusStyle: CSSProperties = { fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.78 };
const dialTitleStyle: CSSProperties = { fontSize: 15, lineHeight: 1.2, fontWeight: 850 };
const dialBodyStyle: CSSProperties = { maxWidth: 260, fontSize: 11, lineHeight: 1.35, opacity: 0.78 };
const rangeWrapStyle: CSSProperties = { display: "grid", gap: 11 };
const tickRailStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, padding: "0 4px" };
const tickStyle: CSSProperties = { width: 2, borderRadius: 999, transition: "opacity 0.1s ease, background-color 0.1s ease" };
const rangeStyle: CSSProperties = { width: "100%", accentColor: "white" };
const saveErrorStyle: CSSProperties = { padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.16)", color: "white", fontSize: 12, lineHeight: 1.4 };
const saveButtonStyle: CSSProperties = { justifySelf: "end", minHeight: 48, borderRadius: 18, border: "none", background: "color-mix(in srgb, white 96%, var(--accent-ink))", color: "var(--text)", padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 800, boxShadow: "0 10px 22px color-mix(in srgb, var(--ink-strong) 12%, transparent)" };
