"use client";

import type { PlanningAllocationItem } from "../app-types";
import { Money } from "../Money";

type SavingsStepProps = {
  items: PlanningAllocationItem[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

export function SavingsStep({ items, onChange }: SavingsStepProps) {
  const updateAmount = (categoryId: string, rawValue: string) => {
    const numericValue = Number(rawValue.replace(/[^0-9.]/g, "")) || 0;
    onChange(items.map((item) => (item.categoryId === categoryId ? { ...item, amount: numericValue } : item)));
  };

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={summaryStyle}>
        <span style={eyebrowStyle}>Savings categories</span>
        <strong style={summaryValueStyle}>{items.length}</strong>
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {items.map((item) => (
          <div key={item.categoryId} style={rowStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "var(--text)", fontSize: 15 }}>
                {item.icon ? `${item.icon} ` : ""}{item.name}
              </strong>
              <span style={metaStyle}>Available now <Money value={item.available ?? 0} /></span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={String(item.amount)}
              onChange={(event) => updateAmount(item.categoryId, event.target.value)}
              aria-label={`Planned savings amount for ${item.name}`}
              style={amountInputStyle}
            />
          </div>
        ))}
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

const summaryStyle = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const summaryValueStyle = {
  color: "var(--text)",
  fontSize: 22,
  lineHeight: 1,
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px",
  gap: 12,
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
};

const metaStyle = {
  fontSize: 12,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
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
