"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Category, MonthlyCategoryTotal } from "./app-types";
import { fmtMoney } from "./app-utils";
import { Money } from "./Money";

type HomeBudgetChartProps = {
  categories: Category[];
  assignedByCategory: MonthlyCategoryTotal[];
  spentByCategory: MonthlyCategoryTotal[];
};

type CategoryLegendItem = {
  key: string;
  label: string;
  color: string;
};

type ChartRow = {
  label: "Assigned" | "Spent";
  [categoryId: string]: number | string;
};

type TooltipRow = {
  label: string;
  value: number;
  color: string;
};

const CHART_COLORS = [
  "#95ab68",
  "#d89e58",
  "#6f9d93",
  "#c96968",
  "#b38f5a",
  "#7b8f6a",
  "#9f7f73",
  "#8f6c9b",
  "#5f8ea8",
  "#c2875d",
];

function buildChartModel(
  categories: Category[],
  assignedByCategory: MonthlyCategoryTotal[],
  spentByCategory: MonthlyCategoryTotal[],
) {
  const categoryMeta = new Map(
    categories.map((category, index) => [
      category.id,
      {
        label: category.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      },
    ]),
  );

  const categoryIds = Array.from(
    new Set([
      ...assignedByCategory.map((item) => item.categoryId),
      ...spentByCategory.map((item) => item.categoryId),
    ]),
  );

  const legendItems: CategoryLegendItem[] = categoryIds.map((categoryId, index) => {
    const meta = categoryMeta.get(categoryId);
    return {
      key: categoryId,
      label: meta?.label ?? `Category ${index + 1}`,
      color: meta?.color ?? CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  const assignedRow: ChartRow = { label: "Assigned" };
  const spentRow: ChartRow = { label: "Spent" };

  for (const item of assignedByCategory) assignedRow[item.categoryId] = item.total;
  for (const item of spentByCategory) spentRow[item.categoryId] = item.total;

  return {
    data: [assignedRow, spentRow],
    legendItems,
  };
}

function BudgetTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const rows: TooltipRow[] = payload
    .filter((item: any) => Number(item.value) > 0)
    .map((item: any) => ({
      label: item.name,
      value: Number(item.value),
      color: item.color,
    }))
    .sort((a: TooltipRow, b: TooltipRow) => b.value - a.value);

  return (
    <div
      style={{
        minWidth: 180,
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface) 94%, white)",
        padding: 12,
        boxShadow: "0 12px 28px color-mix(in srgb, var(--ink-strong) 10%, transparent)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: row.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.label}
              </span>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text)" }}>
              <Money value={row.value} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeBudgetChart({ categories, assignedByCategory, spentByCategory }: HomeBudgetChartProps) {
  const { data, legendItems } = buildChartModel(categories, assignedByCategory, spentByCategory);
  const hasData = legendItems.length > 0;

  if (!hasData) {
    return (
      <div
        style={{
          borderRadius: 18,
          background: "color-mix(in srgb, var(--surface) 92%, white)",
          padding: "18px 16px",
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        No assigned or spent data for this month yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={56} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--border) 78%, transparent)" />
            <XAxis axisLine={false} tickLine={false} dataKey="label" tick={{ fill: "var(--text2)", fontSize: 12, fontWeight: 700 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(value: number) => fmtMoney(value)}
            />
            <Tooltip cursor={{ fill: "color-mix(in srgb, var(--accent) 7%, transparent)" }} content={<BudgetTooltip />} />
            {legendItems.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="budget"
                fill={item.color}
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px" }}>
        {legendItems.map((item) => (
          <div key={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text2)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
