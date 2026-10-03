"use client";

import { useState, type CSSProperties } from "react";
import type { BudgetScope } from "../app-types";
import { fmt } from "../app-utils";
import { ChevronDownIcon } from "../ui/icons";
import { CategoryJar, type CategoryJarState } from "./CategoryJar";
import { Mascot } from "./Mascot";

/**
 * Lab: category jars vs budget bars, on the Budget screen's category cards.
 * Nothing here ships; it's for choosing on a phone.
 */

type Group = "Savings" | "Obligations" | "Long term" | "Wants";
type Sample = { name: string; icon: string; available: number; spent: number; note: string; group: Group; goal?: number; goalBy?: string; added?: number };

const SAMPLES: Sample[] = [
  { name: "Groceries", icon: "🍽️", available: 3100, spent: 1400, note: "Plenty left", group: "Obligations" },
  { name: "Admin", icon: "💳", available: 500, spent: 500, note: "Half", group: "Obligations" },
  { name: "Transportation", icon: "🏍️", available: 90, spent: 510, note: "Spending fast", group: "Obligations" },
  { name: "Medical Bills", icon: "💊", available: -130, spent: 1930, note: "Overspent", group: "Obligations" },
  { name: "Furniture", icon: "🚪", available: 0, spent: 0, note: "Unfunded", group: "Obligations" },
  { name: "Phone", icon: "📱", available: 0, spent: 100, note: "Spent to zero", group: "Wants" },
  { name: "Subscriptions", icon: "🍿", available: 61, spent: 29, note: "Plenty left", group: "Wants" },
];

/** Savings jars fill up towards the goal instead of emptying as money is spent. */
const SAVINGS: Sample[] = [
  { name: "Bedroom", icon: "🛏️", available: 6000, spent: 0, note: "", group: "Savings", goal: 15000, goalBy: "Jun", added: 1000 },
  { name: "Living Room", icon: "🛋️", available: 20000, spent: 0, note: "", group: "Savings", goal: 20000 },
  { name: "Emergency fund", icon: "🛟", available: 47310, spent: 0, note: "", group: "Savings", added: 2000 },
];

type Variant = "redesign" | "today" | "neutral" | "jar-badge" | "jar-inline";
const VARIANTS: { key: Variant; label: string }[] = [
  { key: "redesign", label: "Redesign" },
  { key: "today", label: "Today" },
  { key: "neutral", label: "Neutral bar" },
  { key: "jar-badge", label: "Jar on card" },
  { key: "jar-inline", label: "Jar in row" },
];
const SCOPES: { key: BudgetScope; label: string }[] = [
  { key: "joint", label: "Joint" },
  { key: "anas", label: "Anas" },
  { key: "salma", label: "Salma" },
];

const levelOf = (s: Sample) => {
  const left = Math.max(0, s.available);
  return left / Math.max(1, left + s.spent);
};
const stateOf = (s: Sample): CategoryJarState =>
  s.available < 0 ? "over" : s.available <= 0 ? (s.spent > 0 ? "empty" : "unfunded") : "normal";

/** Same colours the Budget selection tokens resolve to, per wallet (the lab doesn't set data-scope). */
const SCOPE_BAR: Record<BudgetScope, string> = {
  joint: "color-mix(in srgb, var(--partner-husband) 50%, var(--partner-wife))",
  anas: "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

export function CategoryJarLab() {
  const [scope, setScope] = useState<BudgetScope>("joint");
  const [variant, setVariant] = useState<Variant>("redesign");

  return (
    <section aria-label="Category jars" style={sectionStyle}>
      <span style={labelStyle}>Budget cards: jars vs bars</span>
      <div role="group" aria-label="Wallet" style={chipsStyle}>
        {SCOPES.map((s) => <button key={s.key} type="button" aria-pressed={scope === s.key} onClick={() => setScope(s.key)} style={chipStyle(scope === s.key)}>{s.label}</button>)}
      </div>
      <div role="group" aria-label="Variant" style={chipsStyle}>
        {VARIANTS.map((v) => <button key={v.key} type="button" aria-pressed={variant === v.key} onClick={() => setVariant(v.key)} style={chipStyle(variant === v.key)}>{v.label}</button>)}
      </div>

      {variant === "redesign" ? <Redesign scope={scope} /> : <div style={{ display: "grid", gap: variant === "jar-inline" ? 8 : 0 }}>
        {SAMPLES.map((s) => variant === "jar-inline"
          ? <InlineRow key={s.name} sample={s} scope={scope} />
          : <Card key={s.name} sample={s} scope={scope} variant={variant} />)}
      </div>}

      <span style={labelStyle}>Jar sizes (36, 44, 56) and levels</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        {[36, 44, 56].map((size) => <CategoryJar key={size} scope={scope} level={0.6} icon="🍽️" size={size} />)}
        {[1, 0.5, 0.15, 0.04].map((level) => <CategoryJar key={level} scope={scope} level={level} icon="🍽️" size={44} />)}
        <CategoryJar scope={scope} level={0} state="over" icon="💊" size={44} />
        <CategoryJar scope={scope} level={0} state="unfunded" icon="🚪" size={44} />
      </div>
    </section>
  );
}

/**
 * The redesigned Budget list: the wallet jar on top (as on the Budget tab), then the
 * plan sheet's collapsible sections, each a flat stacked list of jar rows.
 */
function Redesign({ scope }: { scope: BudgetScope }) {
  const [closed, setClosed] = useState<Set<Group>>(new Set());
  const groups: Group[] = ["Savings", "Obligations", "Long term", "Wants"];
  const all = [...SAVINGS, ...SAMPLES];
  const left = SAMPLES.reduce((sum, c) => sum + Math.max(0, c.available), 0);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 4, paddingTop: 4 }}>
        <Mascot target={{ scope, gap: 0, mood: "idle", fill: 0.62, outline: "partner" }} size={120} calm />
        <span style={labelStyle}>Allocated</span>
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(left)}</span>
      </div>
      {groups.map((group) => {
        const items = all.filter((c) => c.group === group);
        if (!items.length) return null;
        const open = !closed.has(group);
        const total = items.reduce((sum, c) => sum + c.available, 0);
        return (
          <section key={group} style={{ display: "grid", gap: 4 }}>
            <button type="button" aria-expanded={open} onClick={() => setClosed((prev) => { const next = new Set(prev); if (next.has(group)) next.delete(group); else next.add(group); return next; })} style={sectionToggleStyle}>
              <span style={labelStyle}>{group} <span style={{ fontWeight: 600, opacity: 0.8 }}>{items.length}</span></span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
                <ChevronDownIcon size={16} style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
              </span>
            </button>
            {open && (
              <div style={listSurfaceStyle}>
                {items.map((c) => group === "Savings" ? <SavingsRow key={c.name} sample={c} scope={scope} /> : <JarRow key={c.name} sample={c} scope={scope} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** One budget category: jar (what's left), name, one line only when it matters, Available. */
function JarRow({ sample, scope }: { sample: Sample; scope: BudgetScope }) {
  const state = stateOf(sample);
  const level = levelOf(sample);
  const low = state === "normal" && level < 0.2 && sample.available > 0;
  const line = state === "over" ? { text: "Overspent", color: "var(--status-over)" }
    : low ? { text: "Spending fast", color: "var(--status-low)" }
    : state === "normal" && sample.spent > 0 ? { text: `${fmt(sample.spent)} spent`, color: "var(--muted)" }
    : null;
  return (
    <button type="button" style={jarRowStyle}>
      <CategoryJar scope={scope} level={level} state={state} low={low} icon={sample.icon} size={52} />
      <span style={{ display: "grid", gap: 2, flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={cardNameStyle}>{sample.name}</span>
        {line && <span style={{ fontSize: 12, color: line.color, fontWeight: state === "over" ? 600 : 500 }}>{line.text}</span>}
      </span>
      <span style={amountStyle(state, low)}>{sample.available < 0 ? "−" : ""}{fmt(Math.abs(sample.available))}</span>
    </button>
  );
}

/** Savings: the jar fills towards the goal; without a goal it keeps a still, soft level. */
function SavingsRow({ sample, scope }: { sample: Sample; scope: BudgetScope }) {
  const goal = sample.goal ?? 0;
  const pct = goal > 0 ? Math.min(1, sample.available / goal) : 0;
  const reached = goal > 0 && sample.available >= goal;
  const line = goal > 0
    ? reached ? "Goal reached" : `${Math.floor(pct * 100)}% of ${fmt(goal)}${sample.goalBy ? ` by ${sample.goalBy}` : ""}`
    : sample.added ? `+${fmt(sample.added)} this month` : null;
  return (
    <button type="button" style={jarRowStyle}>
      <CategoryJar scope={scope} level={goal > 0 ? pct : 0.5} kind="savings" icon={sample.icon} size={44} />
      <span style={{ display: "grid", gap: 2, flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={cardNameStyle}>{sample.name}</span>
        {line && <span style={{ fontSize: 12, color: reached ? "var(--status-good)" : "var(--muted)", fontWeight: reached ? 600 : 500 }}>{line}</span>}
      </span>
      <span style={amountStyle("normal", false)}>{fmt(sample.available)}</span>
    </button>
  );
}

/** Today's Budget card (emoji badge on the edge, bar below), with the chosen fill. */
function Card({ sample, scope, variant }: { sample: Sample; scope: BudgetScope; variant: Variant }) {
  const state = stateOf(sample);
  const level = levelOf(sample);
  const low = state === "normal" && level < 0.2 && sample.available > 0;
  const barColor = state === "over" ? "var(--danger)" : low ? "var(--warning)" : variant === "neutral" ? "var(--text2)" : SCOPE_BAR[scope];
  const jar = variant === "jar-badge";
  return (
    <div style={cardStyle}>
      <span style={jar ? jarStageStyle : iconStageStyle} aria-hidden="true">
        {jar ? <CategoryJar scope={scope} level={level} state={state} icon={sample.icon} size={52} /> : <span style={{ fontSize: 34 }}>{sample.icon}</span>}
      </span>
      <div style={{ ...cardBodyStyle, paddingTop: jar ? 30 : 26 }}>
        <span style={{ display: "grid", gap: 8, width: "100%" }}>
          <span style={cardTopStyle}>
            <span style={cardNameStyle}>{sample.name}</span>
            <span style={amountStyle(state, low)}>{fmt(Math.abs(sample.available))}</span>
          </span>
          {!jar && (
            <span style={barStyle} aria-hidden="true">
              <span style={{ display: "block", height: "100%", width: `${state === "over" ? 100 : Math.round(level * 100)}%`, background: barColor, opacity: variant === "neutral" && !low && state !== "over" ? 0.55 : 1 }} />
            </span>
          )}
          <Meta sample={sample} state={state} />
        </span>
      </div>
    </div>
  );
}

/** A tighter card: the jar sits at the start of the row, no badge above and no bar. */
function InlineRow({ sample, scope }: { sample: Sample; scope: BudgetScope }) {
  const state = stateOf(sample);
  const level = levelOf(sample);
  const low = state === "normal" && level < 0.2 && sample.available > 0;
  return (
    <div style={inlineRowStyle}>
      <CategoryJar scope={scope} level={level} state={state} icon={sample.icon} size={48} />
      <span style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
        <span style={cardTopStyle}>
          <span style={cardNameStyle}>{sample.name}</span>
          <span style={amountStyle(state, low)}>{fmt(Math.abs(sample.available))}</span>
        </span>
        <Meta sample={sample} state={state} />
      </span>
    </div>
  );
}

function Meta({ sample, state }: { sample: Sample; state: CategoryJarState }) {
  return (
    <span style={metaStyle}>
      <span>{sample.spent > 0 ? <span style={{ color: "var(--danger)", fontWeight: 650 }}>{fmt(sample.spent)} spent</span> : state === "unfunded" ? "Not funded" : ""}</span>
      <span>{state === "over" ? `${fmt(Math.abs(sample.available))} overspent` : sample.note}</span>
    </span>
  );
}

const sectionStyle: CSSProperties = { display: "grid", gap: 14, padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" };
const chipsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const chipStyle = (on: boolean): CSSProperties => ({
  minHeight: 40, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: on ? "1px solid transparent" : "1px solid var(--border)",
  background: on ? "var(--accent)" : "var(--surface)", color: on ? "var(--accent-ink)" : "var(--text2)",
});
const cardStyle: CSSProperties = { position: "relative", marginTop: 32, display: "flex" };
const iconStageStyle: CSSProperties = { position: "absolute", left: 16, top: -28, width: 56, height: 56, display: "grid", placeItems: "center", zIndex: 2 };
const jarStageStyle: CSSProperties = { position: "absolute", left: 14, top: -30, zIndex: 2 };
const cardBodyStyle: CSSProperties = { flex: 1, display: "flex", minHeight: 96, padding: "26px 16px 12px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: "var(--radius-card)" };
const cardTopStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minWidth: 0 };
const cardNameStyle: CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const amountStyle = (state: CategoryJarState, low: boolean): CSSProperties => ({
  fontSize: 17, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums",
  color: state === "over" ? "var(--status-over)" : low ? "var(--status-low)" : state === "unfunded" ? "var(--muted)" : "var(--text2)",
});
const barStyle: CSSProperties = { width: "100%", height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden", display: "flex" };
const metaStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, color: "var(--muted)", fontSize: 11, fontVariantNumeric: "tabular-nums" };
const sectionToggleStyle: CSSProperties = { minHeight: 44, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", cursor: "pointer", width: "100%", fontFamily: "inherit" };
/** One shared surface per section; rows inside stay flat (no per-row borders). */
const listSurfaceStyle: CSSProperties = { display: "grid", padding: "4px 0", borderRadius: "var(--radius-card)", background: "var(--surface)" };
const jarRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "8px 12px 8px 8px", border: "none", background: "transparent", width: "100%", cursor: "pointer", fontFamily: "inherit", color: "inherit" };
const inlineRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 12px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--surface)" };
