"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { fmt } from "../app-utils";
import { BottomSheet } from "../ui/BottomSheet";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "../ui/icons";
import { MonthPile } from "./MonthPile";

/**
 * Lab: a Calendar tab in place of Reflect. Each month shows its three biggest
 * categories as emojis piled up; tapping one opens that month. Mock data
 * only; nothing here ships.
 */

type Kind = "everyday" | "bill" | "long term";
type CategoryDef = { id: string; name: string; icon: string; kind: Kind };

const CATEGORIES: CategoryDef[] = [
  { id: "groceries", name: "Groceries", icon: "🍽️", kind: "everyday" },
  { id: "dining", name: "Dining out", icon: "☕", kind: "everyday" },
  { id: "transport", name: "Transportation", icon: "🏍️", kind: "everyday" },
  { id: "medical", name: "Medical", icon: "💊", kind: "everyday" },
  { id: "clothing", name: "Clothing", icon: "👕", kind: "everyday" },
  { id: "subscriptions", name: "Subscriptions", icon: "🍿", kind: "everyday" },
  { id: "rent", name: "Rent", icon: "🏠", kind: "bill" },
  { id: "utilities", name: "Utilities", icon: "💡", kind: "bill" },
  { id: "phone", name: "Phone", icon: "📱", kind: "bill" },
  { id: "eid", name: "Eid", icon: "🐑", kind: "long term" },
  { id: "travel", name: "Travel", icon: "✈️", kind: "long term" },
  { id: "car", name: "Car repairs", icon: "🔧", kind: "long term" },
  { id: "gifts", name: "Gifts", icon: "🎁", kind: "long term" },
];
const CATEGORY = new Map(CATEGORIES.map((c) => [c.id, c]));

type Month = { key: string; spent: Record<string, number>; state: "past" | "current" | "future" };

/** Seeded so the lab looks the same on every reload. */
function random(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = { year: 2026, month: 9, day: 27 };

function mockYear(year: number): Month[] {
  const rnd = random(year);
  const around = (base: number, spread: number) => Math.max(0, Math.round((base + (rnd() * 2 - 1) * spread) / 10) * 10);
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const state = year > TODAY.year || (year === TODAY.year && m > TODAY.month) ? "future" : year === TODAY.year && m === TODAY.month ? "current" : "past";
    if (state === "future") return { key, spent: {}, state };
    const spent: Record<string, number> = {
      groceries: around(3000, 450),
      dining: around(850, 350),
      transport: around(600, 220),
      medical: rnd() > 0.7 ? around(900, 400) : around(150, 100),
      clothing: rnd() > 0.6 ? around(700, 400) : around(120, 120),
      subscriptions: 150,
      rent: 5500,
      utilities: around(450, 120),
      phone: 200,
    };
    // The lumpy long-term months that make a year look like a year.
    if (m === 5 || (year === 2025 && m === 6)) spent.eid = 4600;
    if (m === 8) spent.travel = around(7000, 800);
    if (year === 2026 && m === 3) spent.car = 3200;
    if (year === 2025 && m === 12) spent.gifts = 1800;
    if (year === 2026 && m === 9) spent.dining = 1840; // this month's surprise
    if (state === "current") for (const id in spent) spent[id] = Math.round((spent[id] * TODAY.day) / 30 / 10) * 10;
    return { key, spent, state };
  });
}

type Options = { skipBills: boolean };

function summarize(month: Month, skipBills: boolean) {
  const rows = Object.entries(month.spent)
    .filter(([id, amount]) => amount > 0 && !(skipBills && CATEGORY.get(id)?.kind === "bill"))
    .map(([id, amount]) => ({ ...CATEGORY.get(id)!, amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const top = rows.slice(0, 3);
  return { rows, total, top, rest: total - top.reduce((sum, row) => sum + row.amount, 0) };
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : fmt(Math.round(n)));
const monthLabel = (key: string, format: "short" | "long" = "short") =>
  new Date(`${key}-01T12:00:00`).toLocaleDateString("en", { month: format, ...(format === "long" ? { year: "numeric" } : {}) });

export function CalendarLab() {
  const [year, setYear] = useState(TODAY.year);
  const [options, setOptions] = useState<Options>({ skipBills: true });
  const [openKey, setOpenKey] = useState<string | null>(null);

  const months = useMemo(() => mockYear(year), [year]);
  const summaries = useMemo(() => months.map((m) => ({ month: m, ...summarize(m, options.skipBills) })), [months, options.skipBills]);
  const max = Math.max(1, ...summaries.map((s) => s.total));
  const yearTotal = summaries.reduce((sum, s) => sum + s.total, 0);
  const open = summaries.find((s) => s.month.key === openKey);
  const set = <K extends keyof Options>(key: K, value: Options[K]) => setOptions((prev) => ({ ...prev, [key]: value }));

  return (
    <main style={pageStyle}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Calendar</h1>
        <span style={mutedStyle}>Lab · mock data · not in the app yet</span>
      </header>

      <section aria-label="Lab options" style={{ display: "grid", gap: 8 }}>
        <div role="group" aria-label="What's piled" style={chipsStyle}>
          <button type="button" aria-pressed={options.skipBills} onClick={() => set("skipBills", !options.skipBills)} style={chipStyle(options.skipBills)}>Leave out fixed bills</button>
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} disabled={year <= 2025} style={iconButtonStyle}><ChevronLeftIcon /></button>
        <div style={{ display: "grid", justifyItems: "center", gap: 2 }}>
          <strong style={{ fontSize: 20, fontWeight: 600 }}>{year}</strong>
          <span style={mutedStyle}>{fmt(yearTotal)} MAD{year === TODAY.year ? " so far" : ""}{options.skipBills ? " · without bills" : ""}</span>
        </div>
        <button type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)} disabled={year >= TODAY.year} style={iconButtonStyle}><ChevronRightIcon /></button>
      </div>

      <ol aria-label={`Months of ${year}`} style={gridStyle}>
        {summaries.map(({ month, total, top }) => {
          const future = month.state === "future";
          // Pile size follows the month's total, with a floor so a quiet month still reads.
          const fill = 0.16 + 0.4 * (total / max);
          const label = future
            ? `${monthLabel(month.key, "long")}, not started`
            : `${monthLabel(month.key, "long")}, ${fmt(total)} MAD${month.state === "current" ? " so far" : ""}, mostly ${top.map((row) => row.name).join(", ")}`;
          return (
            <li key={month.key}>
              <button type="button" disabled={future} aria-label={label} onClick={() => setOpenKey(month.key)} style={monthButtonStyle(future)}>
                <span style={{ fontSize: 13, fontWeight: 600, color: month.state === "current" ? "var(--select-ink)" : "var(--text2)" }}>{monthLabel(month.key)}</span>
                <span style={{ height: 96, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  {!future && <MonthPile categories={top} fill={fill} />}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums", minHeight: 16 }}>
                  {future ? "" : `${compact(total)}${month.state === "current" ? " so far" : ""}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p style={{ ...mutedStyle, margin: 0, textAlign: "center" }}>
        Each month piles up its three biggest categories. A bigger emoji means more was spent there.
      </p>

      <BottomSheet open={Boolean(open)} onClose={() => setOpenKey(null)} label={open ? monthLabel(open.month.key, "long") : "Month"} maxWidth="480px" contentStyle={sheetContentStyle}>
        {open && <>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{monthLabel(open.month.key, "long")}</h2>
            <button type="button" aria-label="Close" onClick={() => setOpenKey(null)} style={iconButtonStyle}><XIcon size={20} /></button>
          </header>
          <div style={{ overflowY: "auto", display: "grid", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <MonthPile categories={open.top} fill={0.5} size={88} />
              <div style={{ display: "grid", gap: 2 }}>
                <span style={mutedStyle}>{open.month.state === "current" ? "Spent so far" : "Spent"}</span>
                <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(open.total)} MAD</span>
              </div>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {open.top.map((row) => (
                <li key={row.id} style={rowStyle}>
                  <span aria-hidden="true" style={emojiStyle}>{row.icon}</span>
                  <span style={{ flex: 1, color: "var(--text2)", fontSize: 15, fontWeight: 500 }}>{row.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(row.amount)}</span>
                </li>
              ))}
              {open.rest > 0 && (
                <li style={rowStyle}>
                  <span aria-hidden="true" style={emojiStyle} />
                  <span style={{ flex: 1, color: "var(--muted)", fontSize: 15 }}>Everything else · {open.rows.length - open.top.length} categories</span>
                  <span style={{ fontSize: 15, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmt(open.rest)}</span>
                </li>
              )}
            </ul>
            <p style={{ ...mutedStyle, margin: 0 }}>The rest of the month view is still to be designed.</p>
          </div>
        </>}
      </BottomSheet>
    </main>
  );
}

const mutedStyle: CSSProperties = { fontSize: 13, color: "var(--muted)", lineHeight: 1.5 };
const pageStyle: CSSProperties = {
  display: "grid", gap: 24, maxWidth: 480, margin: "0 auto", padding: "calc(var(--safe-top, 0px) + 24px) 16px 64px", boxSizing: "border-box", minHeight: "100dvh", background: "var(--bg)", color: "var(--text)",
};
const chipsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const chipStyle = (on: boolean): CSSProperties => ({
  minHeight: 44, padding: "0 14px", border: 0, borderRadius: 999, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: on ? "var(--select-wash)" : "var(--surface2)", color: on ? "var(--select-ink)" : "var(--text2)",
});
const iconButtonStyle: CSSProperties = { width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: "var(--radius-control)", background: "transparent", color: "var(--text2)", cursor: "pointer" };
const gridStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", rowGap: 20, columnGap: 8 };
const monthButtonStyle = (future: boolean): CSSProperties => ({
  width: "100%", display: "grid", justifyItems: "center", gap: 6, padding: "8px 0", border: 0, borderRadius: "var(--radius-card)", background: "transparent", font: "inherit", cursor: future ? "default" : "pointer", opacity: future ? 0.55 : 1,
});
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 52 };
const emojiStyle: CSSProperties = { width: 32, display: "inline-flex", justifyContent: "center", fontSize: 22, flexShrink: 0 };
const sheetContentStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px max(20px, env(safe-area-inset-bottom))", boxSizing: "border-box" };
