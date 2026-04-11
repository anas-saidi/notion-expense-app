"use client";

import type { ReactNode } from "react";
import type { MonthlyPlanningSnapshot, PlanningAllocationItem, PlanningIncomeItem } from "../app-types";
import { Money } from "../Money";

type ReviewStepProps = {
  snapshot: MonthlyPlanningSnapshot;
  incomeItems: PlanningIncomeItem[];
  budgetItems: PlanningAllocationItem[];
  savingsItems: PlanningAllocationItem[];
  hasCloseAttention: boolean;
};

export function ReviewStep({
  snapshot,
  incomeItems,
  budgetItems,
  savingsItems,
  hasCloseAttention,
}: ReviewStepProps) {
  const isComplete = snapshot.leftToAssign === 0;
  const isOver = snapshot.leftToAssign < 0;
  const isAlmost = snapshot.leftToAssign > 0 && snapshot.leftToAssign <= 50;
  const readinessLabel =
    hasCloseAttention || isOver
      ? "Needs review"
      : isComplete
        ? "Ready to save"
        : "Almost ready";

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div
        className={`review-summary${isComplete ? " review-summary--ready" : ""}${
          isAlmost ? " review-summary--almost" : ""
        }`}
        style={summaryNoteStyle}
      >
        <strong style={summaryTitleStyle}>{readinessLabel}</strong>
        <span style={summaryCopyStyle}>
          {isOver
            ? "You have assigned more than the available pool."
            : isComplete
              ? "All set. Future-you approves."
              : "There is still money left to assign before finishing."}
        </span>
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        <Row label="Income lines" value={String(incomeItems.length)} />
        <Row label="Budget categories" value={String(budgetItems.length)} />
        <Row label="Savings categories" value={String(savingsItems.length)} />
        <Row label="Available pool" value={<Money value={snapshot.availablePool} />} />
        <Row label="Assigned budgets" value={<Money value={snapshot.assignedHousehold} />} />
        <Row label="Assigned savings" value={<Money value={snapshot.assignedSavings} />} />
        <Row
          label="Left to assign"
          value={
            <span className="review-left-assign">
              <Money value={snapshot.leftToAssign} />
              {isComplete && (
                <span className="review-check" aria-hidden="true">
                  <svg viewBox="0 0 16 12" width="16" height="12" fill="none">
                    <path d="M1.5 6.2l3.6 3.6L14.5 1.5" />
                  </svg>
                </span>
              )}
            </span>
          }
        />
      </div>

      <div style={noteStyle}>
        {hasCloseAttention ? "Close-month review still has unresolved items." : "Close-month review is clear."}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      <strong style={rowValueStyle}>{value}</strong>
    </div>
  );
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
};

const rowLabelStyle = {
  color: "var(--text2)",
  fontSize: 14,
};

const rowValueStyle = {
  color: "var(--text)",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};

const noteStyle = {
  color: "var(--text2)",
  fontSize: 13,
  lineHeight: 1.5,
};

const summaryNoteStyle = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--surface2) 50%, white)",
};

const summaryTitleStyle = {
  color: "var(--text)",
  fontSize: 14,
};

const summaryCopyStyle = {
  color: "var(--text2)",
  fontSize: 13,
  lineHeight: 1.5,
};
