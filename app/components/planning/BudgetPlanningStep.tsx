"use client";

import { useMemo, useState } from "react";
import type { PlanningAllocationItem } from "../app-types";
import { Money } from "../Money";

type BudgetPlanningStepProps = {
  householdItems: PlanningAllocationItem[];
  wifeItems: PlanningAllocationItem[];
  husbandItems: PlanningAllocationItem[];
  savingsItems: PlanningAllocationItem[];
  fundByCategoryId: Record<string, { id: string; planned: number }>;
  onHouseholdChange: (items: PlanningAllocationItem[]) => void;
  onWifeChange: (items: PlanningAllocationItem[]) => void;
  onHusbandChange: (items: PlanningAllocationItem[]) => void;
  onSavingsChange: (items: PlanningAllocationItem[]) => void;
  onFundUpdate: (categoryId: string, amount: number) => void;
};

type BudgetGroupKey = "household" | "wife" | "husband" | "savings";

type BudgetGroup = {
  key: BudgetGroupKey;
  label: string;
  items: PlanningAllocationItem[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

export function BudgetPlanningStep({
  householdItems,
  wifeItems,
  husbandItems,
  savingsItems,
  fundByCategoryId,
  onHouseholdChange,
  onWifeChange,
  onHusbandChange,
  onSavingsChange,
  onFundUpdate,
}: BudgetPlanningStepProps) {
  const groups = useMemo<BudgetGroup[]>(
    () => [
      { key: "household", label: "Household", items: householdItems, onChange: onHouseholdChange },
      { key: "wife", label: "Wife", items: wifeItems, onChange: onWifeChange },
      { key: "husband", label: "Husband", items: husbandItems, onChange: onHusbandChange },
      { key: "savings", label: "Savings", items: savingsItems, onChange: onSavingsChange },
    ],
    [householdItems, husbandItems, onHouseholdChange, onHusbandChange, onSavingsChange, onWifeChange, savingsItems, wifeItems],
  );

  const [activeGroup, setActiveGroup] = useState<BudgetGroupKey>(() => {
    if (householdItems.length) return "household";
    if (wifeItems.length) return "wife";
    if (husbandItems.length) return "husband";
    return "savings";
  });

  const active = groups.find((group) => group.key === activeGroup) ?? groups[0];

  const updateAmount = (categoryId: string, rawValue: string) => {
    const numericValue = Number(rawValue.replace(/[^0-9.]/g, "")) || 0;
    active.onChange(
      active.items.map((item) =>
        item.categoryId === categoryId ? { ...item, amount: numericValue } : item,
      ),
    );
    onFundUpdate(categoryId, numericValue);
  };

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <span style={eyebrowStyle}>Budget categories</span>
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
                {item.icon ? `${item.icon} ` : ""}{item.name}
              </strong>
              <div style={metaRowStyle}>
                <span style={lastMonthStyle}>Last month <Money value={item.lastMonthSpent ?? 0} /></span>
                <span style={availableStyle}>Available <Money value={item.available ?? 0} /></span>
                {fundByCategoryId[item.categoryId] && (
                  <span style={fundedStyle}>Funded</span>
                )}
              </div>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={String(item.amount)}
              onChange={(event) => updateAmount(item.categoryId, event.target.value)}
              aria-label={`Planned amount for ${item.name}`}
              style={amountInputStyle}
            />
          </div>
        ))}

        {active.items.length === 0 && (
          <div style={emptyStyle}>No categories in this group yet.</div>
        )}
      </div>
    </section>
  );
}

const eyebrowStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const chipStyle = {
  borderRadius: 999,
  padding: "6px 12px",
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface) 94%, white)",
  color: "var(--text2)",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const chipActiveStyle = {
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
  background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
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
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
};

const metaRowStyle = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const lastMonthStyle = {
  fontSize: 12,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
};

const availableStyle = {
  fontSize: 11,
  color: "color-mix(in srgb, var(--muted) 80%, transparent)",
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: 0.3,
};

const fundedStyle = {
  fontSize: 10,
  color: "color-mix(in srgb, var(--accent) 70%, var(--text))",
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
};

const amountInputStyle = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
  background: "transparent",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 16,
  textAlign: "right" as const,
};

const emptyStyle = {
  padding: "16px 0",
  color: "var(--muted)",
  fontSize: 13,
};
