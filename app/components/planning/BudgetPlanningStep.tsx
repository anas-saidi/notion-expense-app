"use client";

import { useMemo, useRef, useState } from "react";
import type { Category, PlanningAllocationItem } from "../app-types";
import { Money } from "../Money";
import { CategoryIcon } from "../ui/CategoryIcon";
import { PickerPopover } from "../PickerPopover";

type BudgetPlanningStepProps = {
  householdItems: PlanningAllocationItem[];
  wifeItems: PlanningAllocationItem[];
  husbandItems: PlanningAllocationItem[];
  savingsItems: PlanningAllocationItem[];
  availableHouseholdCategories?: Category[];
  availableWifeCategories?: Category[];
  availableHusbandCategories?: Category[];
  availableSavingsCategories?: Category[];
  fundByCategoryId?: Record<string, boolean>;
  poolRemaining?: number;
  onHouseholdChange: (items: PlanningAllocationItem[]) => void;
  onWifeChange: (items: PlanningAllocationItem[]) => void;
  onHusbandChange: (items: PlanningAllocationItem[]) => void;
  onSavingsChange: (items: PlanningAllocationItem[]) => void;
  onFundUpdate?: (categoryId: string, targetPlanned: number, currentPlanned: number) => void;
};

type BudgetGroupKey = "household" | "wife" | "husband" | "savings";

type BudgetGroup = {
  key: BudgetGroupKey;
  label: string;
  items: PlanningAllocationItem[];
  availableCategories: Category[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

export function BudgetPlanningStep({
  householdItems,
  wifeItems,
  husbandItems,
  savingsItems,
  availableHouseholdCategories = [],
  availableWifeCategories = [],
  availableHusbandCategories = [],
  availableSavingsCategories = [],
  fundByCategoryId = {},
  poolRemaining,
  onHouseholdChange,
  onWifeChange,
  onHusbandChange,
  onSavingsChange,
  onFundUpdate,
}: BudgetPlanningStepProps) {
  const groups = useMemo<BudgetGroup[]>(
    () => [
      { key: "household", label: "Household", items: householdItems, availableCategories: availableHouseholdCategories, onChange: onHouseholdChange },
      { key: "wife", label: "Wife", items: wifeItems, availableCategories: availableWifeCategories, onChange: onWifeChange },
      { key: "husband", label: "Husband", items: husbandItems, availableCategories: availableHusbandCategories, onChange: onHusbandChange },
      { key: "savings", label: "Savings", items: savingsItems, availableCategories: availableSavingsCategories, onChange: onSavingsChange },
    ],
    [availableHouseholdCategories, availableHusbandCategories, availableSavingsCategories, availableWifeCategories, householdItems, husbandItems, onHouseholdChange, onHusbandChange, onSavingsChange, onWifeChange, savingsItems, wifeItems],
  );

  const [activeGroup, setActiveGroup] = useState<BudgetGroupKey>(() => {
    if (householdItems.length) return "household";
    if (wifeItems.length) return "wife";
    if (husbandItems.length) return "husband";
    return "savings";
  });
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const addAnchorRef = useRef<HTMLButtonElement>(null);
  const dragStateRef = useRef<{
    categoryId: string;
    startY: number;
    startValue: number;
  } | null>(null);

  const active = groups.find((group) => group.key === activeGroup) ?? groups[0];
  const existingIds = useMemo(() => new Set(active.items.map((item) => item.categoryId)), [active.items]);
  const totalPlanned = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.reduce((inner, item) => inner + item.amount, 0), 0),
    [groups],
  );
  const totalPool = Math.max(1, totalPlanned + (poolRemaining ?? 0));
  const availableOptions = useMemo(() => {
    const search = addSearch.trim().toLowerCase();
    const options = active.availableCategories;
    if (!search) return options;
    return options.filter((category) => category.name.toLowerCase().includes(search));
  }, [active.availableCategories, addSearch]);

  const addCategory = (category: Category) => {
    if (existingIds.has(category.id)) return;
    active.onChange([...active.items, toAllocationItem(category)]);
    setShowAdd(false);
    setAddSearch("");
  };

  const resolveSpentFloor = (currentPlanned: number, available: number | null) =>
    Math.max(0, currentPlanned - (available ?? currentPlanned));

  const clampPlannedValue = (rawValue: number, currentPlanned: number, available: number | null) => {
    const spentFloor = resolveSpentFloor(currentPlanned, available);
    const fallbackMax = currentPlanned + 10000;
    const maxAllowed = typeof poolRemaining === "number"
      ? Math.max(spentFloor, currentPlanned + poolRemaining)
      : Math.max(spentFloor, fallbackMax);
    return Math.min(maxAllowed, Math.max(spentFloor, rawValue));
  };

  const updateAmount = (categoryId: string, rawValue: string, currentPlanned: number, available: number | null) => {
    const numericValue = Number(rawValue.replace(/[^0-9.]/g, "")) || 0;
    const nextValue = clampPlannedValue(numericValue, currentPlanned, available);
    active.onChange(
      active.items.map((item) =>
        item.categoryId === categoryId ? { ...item, amount: nextValue } : item,
      ),
    );
    onFundUpdate?.(categoryId, nextValue, currentPlanned);
  };

  const nudgeAmount = (categoryId: string, currentValue: number, delta: number, available: number | null) => {
    const nextValue = Math.max(0, currentValue + delta);
    updateAmount(categoryId, String(nextValue), currentValue, available);
  };

  const handleKeyAdjust = (
    event: React.KeyboardEvent<HTMLInputElement>,
    categoryId: string,
    currentValue: number,
    available: number | null,
  ) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const baseStep = event.shiftKey ? 100 : event.altKey ? 1 : 10;
    const delta = event.key === "ArrowUp" ? baseStep : -baseStep;
    nudgeAmount(categoryId, currentValue, delta, available);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLInputElement>,
    categoryId: string,
    currentValue: number,
  ) => {
    if (event.pointerType !== "touch") return;
    dragStateRef.current = {
      categoryId,
      startY: event.clientY,
      startValue: currentValue,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLInputElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerType !== "touch") return;
    const deltaY = dragState.startY - event.clientY;
    const step = 10;
    const ticks = Math.round(deltaY / 12);
    const nextValue = Math.max(0, dragState.startValue + ticks * step);
    const currentItem = active.items.find((item) => item.categoryId === dragState.categoryId);
    const currentPlanned = currentItem?.amount ?? 0;
    const currentAvailable = currentItem?.available ?? null;
    updateAmount(dragState.categoryId, String(nextValue), currentPlanned, currentAvailable);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLInputElement>) => {
    if (event.pointerType !== "touch") return;
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={headRowStyle}>
          <span style={eyebrowStyle}>Budget categories</span>
          <button
            ref={addAnchorRef}
            type="button"
            onClick={() => setShowAdd((prev) => !prev)}
            style={addButtonStyle}
            aria-label="Add budget category"
            aria-expanded={showAdd}
          >
            + Add budget
          </button>
          <PickerPopover open={showAdd} align="right" placement="bottom" anchorRef={addAnchorRef}>
            <div style={addPopoverStyle}>
              <input
                type="text"
                value={addSearch}
                onChange={(event) => setAddSearch(event.target.value)}
                placeholder={`Search ${active.label.toLowerCase()} categories`}
                style={addSearchStyle}
              />
              <div style={addListStyle}>
                {availableOptions.map((category) => {
                  const isAdded = existingIds.has(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => addCategory(category)}
                      style={{
                        ...addOptionStyle,
                        ...(isAdded ? addOptionDisabledStyle : null),
                      }}
                      disabled={isAdded}
                    >
                      <CategoryIcon icon={category.icon} style={addOptionIconStyle} />
                      <span style={addOptionLabelStyle}>{category.name}</span>
                      {isAdded && <span style={addOptionBadgeStyle}>Added</span>}
                    </button>
                  );
                })}
                {availableOptions.length === 0 && (
                  <div style={addEmptyStyle}>No categories available.</div>
                )}
              </div>
            </div>
          </PickerPopover>
        </div>
        <div style={chipRowStyle} role="tablist" aria-label="Budget groups">
          {groups.map((group) => {
            const isActive = group.key === activeGroup;
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveGroup(group.key)}
                style={{
                  ...chipStyle,
                  ...(isActive ? chipActiveStyle : null),
                }}
              >
                <span style={{ fontWeight: isActive ? 650 : 600 }}>{group.label}</span>
                <span style={chipCountStyle}>{group.items.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {active.items.map((item) => (
          <div key={item.categoryId} style={rowStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "var(--text)", fontSize: 15 }}>
                {item.icon ? <CategoryIcon icon={item.icon} size={18} style={{ marginRight: 4 }} /> : null}{item.name}
              </strong>
              <div style={metaRowStyle}>
                {(item.lastMonthSpent ?? 0) > 0 && (
                  <span style={lastMonthStyle}>Last month <Money value={item.lastMonthSpent ?? 0} /></span>
                )}
                {fundByCategoryId[item.categoryId] && (
                  <span style={fundedStyle}>Funded</span>
                )}
              </div>
            </div>
            <div style={inputWrapStyle}>
              <div style={inputMetaStyle}>
                <span style={targetLabelStyle}>Planned</span>
                <span style={nowLabelStyle}>
                  Spent <Money value={Math.max(0, item.amount - (item.available ?? item.amount))} />
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={String(item.amount)}
                onChange={(event) => updateAmount(item.categoryId, event.target.value, item.amount, item.available ?? null)}
                onKeyDown={(event) => handleKeyAdjust(event, item.categoryId, item.amount, item.available ?? null)}
                onPointerDown={(event) => handlePointerDown(event, item.categoryId, item.amount)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                placeholder="Plan"
                aria-label={`Planned amount for ${item.name}`}
                style={amountInputStyle}
              />
              <div style={spentBarTrackStyle} aria-hidden="true">
                <div
                  style={{
                    ...spentBarFillStyle,
                    width: `${Math.min(100, ((Math.max(0, item.amount - (item.available ?? item.amount))) / Math.max(1, item.amount)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div style={sliderWrapStyle}>
              <div style={sliderTrackStyle}>
                <div
                  style={{
                    ...sliderFillStyle,
                    width: `${Math.min(100, (item.amount / totalPool) * 100)}%`,
                  }}
                />
                <div
                  style={{
                    ...sliderThumbStyle,
                    left: `${Math.min(100, (item.amount / totalPool) * 100)}%`,
                  }}
                />
                <input
                  type="range"
                  min={resolveSpentFloor(item.amount, item.available ?? null)}
                  max={clampPlannedValue(Number.MAX_SAFE_INTEGER, item.amount, item.available ?? null)}
                  step={10}
                  value={item.amount}
                  onChange={(event) => updateAmount(item.categoryId, event.target.value, item.amount, item.available ?? null)}
                  aria-label={`Planned slider for ${item.name}`}
                  style={sliderInputStyle}
                />
              </div>
            </div>
          </div>
        ))}

        {active.items.length === 0 && (
          <div style={emptyStyle}>No categories in this group yet.</div>
        )}
      </div>
    </section>
  );
}

const toAllocationItem = (category: Category): PlanningAllocationItem => ({
  categoryId: category.id,
  name: category.name,
  icon: category.icon,
  amount: category.planned ?? category.available ?? 0,
  available: category.available,
  lastMonthSpent: category.lastMonthSpent,
});

const eyebrowStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
};

const headRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const addButtonStyle = {
  borderRadius: 999,
  padding: "6px 12px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const addPopoverStyle = {
  display: "grid",
  gap: 8,
  padding: 10,
};

const addSearchStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const addListStyle = {
  display: "grid",
  gap: 4,
  maxHeight: 220,
  overflowY: "auto" as const,
};

const addOptionStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "none",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "left" as const,
};

const addOptionDisabledStyle = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const addOptionIconStyle = {
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "var(--surface2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  flexShrink: 0,
};

const addOptionLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
};

const addOptionBadgeStyle = {
  marginLeft: "auto",
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 9,
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
};

const addEmptyStyle = {
  padding: "10px 8px",
  color: "var(--muted)",
  fontSize: 12,
};

const chipStyle = {
  borderRadius: 999,
  padding: "6px 12px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  color: "var(--text2)",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const chipActiveStyle = {
  border: "1px solid transparent",
  background: "var(--accent-dim)",
  color: "var(--text)",
};

const chipCountStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  opacity: 0.7,
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px",
  gap: 12,
  alignItems: "start",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
};

const metaRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
};

const metaLabelStyle = {
  fontSize: 10,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: 0.3,
};

const lastMonthStyle = {
  ...metaLabelStyle,
};

const availableStyle = {
  ...metaLabelStyle,
};

const fundedStyle = {
  ...metaLabelStyle,
  color: "color-mix(in srgb, var(--accent) 70%, var(--text))",
  marginLeft: "auto",
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "var(--accent-dim)",
};

const amountInputStyle = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 16,
  textAlign: "right" as const,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
  touchAction: "none" as const,
};

const inputWrapStyle = {
  display: "grid",
  gap: 4,
};

const spentBarTrackStyle = {
  height: 6,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  overflow: "hidden",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const spentBarFillStyle = {
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 65%, #d8f3c9)",
  transition: "width 0.18s ease",
};

const sliderWrapStyle = {
  gridColumn: "1 / -1",
  paddingTop: 8,
};

const sliderTrackStyle = {
  position: "relative" as const,
  height: 10,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--border) 36%, transparent)",
};

const sliderFillStyle = {
  position: "absolute" as const,
  inset: 0,
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 85%, #bceaa2)",
  opacity: 0.28,
  transition: "width 0.15s ease",
  pointerEvents: "none" as const,
};

const sliderThumbStyle = {
  position: "absolute" as const,
  top: "50%",
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface) 70%, white)",
  border: "2px solid var(--accent)",
  transform: "translate(-50%, -50%)",
  boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  transition: "left 0.15s ease",
  pointerEvents: "none" as const,
};

const sliderInputStyle = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  opacity: 0,
  cursor: "pointer",
  touchAction: "none" as const,
  zIndex: 2,
};

const inputMetaStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 14,
};

const targetLabelStyle = {
  fontSize: 10,
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
  color: "color-mix(in srgb, var(--text2) 86%, transparent)",
};

const nowLabelStyle = {
  fontSize: 10,
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: 0.3,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
};


const emptyStyle = {
  padding: "16px 0",
  color: "var(--muted)",
  fontSize: 13,
};
