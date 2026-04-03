"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, PlanningIncomeItem, PlanningIncomeStepState } from "../app-types";
import { fmtDate } from "../app-utils";
import { Money } from "../Money";

type IncomeStepProps = {
  selectedMonth: string;
  accounts: Account[];
  value: PlanningIncomeItem[];
  onChange: (items: PlanningIncomeItem[], meta: Pick<PlanningIncomeStepState, "confirmedTotal" | "ready" | "source">) => void;
  compact?: boolean;
};

export function IncomeStep({
  selectedMonth,
  accounts,
  value,
  onChange,
  compact = false,
}: IncomeStepProps) {
  const [items, setItems] = useState<PlanningIncomeItem[]>(value);
  const [loading, setLoading] = useState(value.length === 0);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/monthly-income?month=${selectedMonth}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok && !data.items) throw new Error(data.error || "Failed to load monthly income");
        return data as { items: PlanningIncomeItem[]; source: "live" | "mock" };
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setSource(data.source ?? "mock");
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load monthly income");
        setItems([]);
        setSource("mock");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const confirmedTotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(item.amount || 0, 0), 0),
    [items],
  );

  useEffect(() => {
    onChange(items, {
      confirmedTotal,
      ready: items.length > 0 && confirmedTotal > 0,
      source,
    });
  }, [confirmedTotal, items, onChange, source]);

  const updateAmount = (id: string, rawValue: string) => {
    const numericValue = Number(rawValue.replace(/[^0-9.]/g, "")) || 0;
    setItems((current) => current.map((item) => (item.id === id ? { ...item, amount: numericValue } : item)));
  };

  return (
    <section style={{ display: "grid", gap: compact ? 10 : 12 }}>
      <div style={summaryBarStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <span style={eyebrowStyle}>{source === "mock" ? "Estimated income" : "Confirmed income"}</span>
          <strong style={summaryValueStyle}><Money value={confirmedTotal} /></strong>
        </div>
      </div>

      {loading && <div style={panelStyle}>Loading income for the selected month...</div>}
      {!loading && error && <div style={panelStyle}>{error}</div>}

      {!loading && (
        <div style={{ display: "grid", gap: 0 }}>
          {items.map((item) => {
            const account = item.accountId ? accounts.find((entry) => entry.id === item.accountId) : null;
            return (
              <div key={item.id} style={rowStyle}>
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <strong style={{ color: "var(--text)", fontSize: 15 }}>{item.name}</strong>
                  <span style={metaStyle}>
                    {[account?.label ?? "Unassigned account", fmtDate(item.date)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={String(item.amount)}
                  onChange={(event) => updateAmount(item.id, event.target.value)}
                  aria-label={`Income amount for ${item.name}`}
                  style={amountInputStyle}
                />
              </div>
            );
          })}

          {items.length === 0 && !error && <div style={panelStyle}>No income entries were found for this month yet.</div>}
        </div>
      )}
    </section>
  );
}

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const summaryBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const summaryValueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 24,
  lineHeight: 1,
};

const panelStyle: CSSProperties = {
  padding: "14px 0",
  color: "var(--text2)",
  fontSize: 13,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px",
  gap: 12,
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
};

const metaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
};

const amountInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
  background: "transparent",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 16,
  textAlign: "right",
};
