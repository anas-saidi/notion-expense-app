"use client";

import { type CSSProperties } from "react";
import { Money } from "./Money";

export type Scope = "household" | "wife" | "husband";

type StatView = {
  spent: number;
  planned: number;
};

type HouseholdStatCardProps = {
  views: Record<Scope, StatView>;
  scope: Scope;
  onScopeChange: (nextScope: Scope) => void;
  readyToAssignByScope: Record<Scope, number>;
  contributionDueByScope?: { wife: number; husband: number; total: number };
  householdSpentByPartner?: { wife: number; husband: number; other: number; total: number };
};

const SCOPE_LABELS: Record<Scope, string> = {
  household: "Joint",
  wife: "Salma",
  husband: "Anas",
};

const SCOPE_ORDER: Scope[] = ["household", "wife", "husband"];

export function HouseholdStatCard({
  views,
  scope,
  onScopeChange,
  readyToAssignByScope,
}: HouseholdStatCardProps) {
  const activeView = views[scope];
  const assigned = Math.max(0, activeView.planned ?? 0);
  const spent = Math.max(0, activeView.spent ?? 0);
  const remaining = scope === "household"
    ? assigned - spent
    : readyToAssignByScope[scope] ?? 0;

  return (
    <section style={shellStyle} aria-label="Monthly budget summary">
      <div style={scopeTabsStyle} role="tablist" aria-label="Budget scope">
        {SCOPE_ORDER.map((item) => {
          const active = item === scope;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onScopeChange(item)}
              style={{
                ...scopeTabStyle,
                ...(active ? scopeTabActiveStyle : null),
              }}
            >
              {SCOPE_LABELS[item]}
            </button>
          );
        })}
      </div>

      <div style={metricsStyle}>
        <Metric label="Assigned" value={assigned} />
        <Metric label="Spent" value={spent} />
        <Metric
          label={scope === "household" ? "Available" : "Ready"}
          value={Math.abs(remaining)}
          tone={remaining < 0 ? "danger" : "default"}
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: tone === "danger" ? "var(--danger)" : "var(--text)" }}>
        <Money value={value} />
      </strong>
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const scopeTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
};

const scopeTabStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--surface2) 62%, white)",
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 650,
  cursor: "pointer",
};

const scopeTabActiveStyle: CSSProperties = {
  background: "var(--text)",
  color: "var(--surface)",
};

const metricsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  paddingTop: 2,
};

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const metricLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.24,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const metricValueStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 760,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};
