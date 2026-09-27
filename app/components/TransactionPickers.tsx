"use client";

import type { CSSProperties } from "react";
import type { Account, Category } from "./app-types";
import { Money } from "./Money";
import { useAppHaptics } from "./ui/useAppHaptics";

/**
 * The option lists inside the composer's anchored pickers. The Add transaction
 * form and Type it share them, so every account and category picker looks and
 * behaves the same.
 */

export function AccountOptionList({ id, accounts, selectedId, onSelect }: {
  id?: string;
  accounts: Account[];
  selectedId: string | null | undefined;
  onSelect: (accountId: string) => void;
}) {
  const { haptic } = useAppHaptics();
  return (
    <div id={id} style={{ maxHeight: 236, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
      <div style={{ display: "grid", gap: 2 }}>
        {accounts.map((acct) => {
          const selected = acct.id === selectedId;
          return (
            <button className="picker-option" aria-pressed={selected} key={acct.id} onClick={() => { if (!selected) haptic("selection"); onSelect(acct.id); }} style={optionRowStyle(selected)}>
              <div style={pickerIconStyle}>{acct.icon ?? "$"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: selected ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</div>
                {acct.type && <div style={pickerMetaStyle}>{acct.type}</div>}
              </div>
              {acct.balance !== null && (
                <span style={{ ...monoSmallStyle, color: acct.balance < 0 ? "var(--danger)" : "var(--muted)", paddingLeft: 8 }}>
                  <Money value={acct.balance} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryOptionList({ id, categories, selectedId, lastUsedId, onSelect, search, onSearchChange }: {
  id?: string;
  /** Already filtered by `search`. */
  categories: Category[];
  selectedId: string | null | undefined;
  lastUsedId?: string | null;
  onSelect: (category: Category) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { haptic } = useAppHaptics();
  return (
    <div id={id} style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ maxHeight: 164, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
        <div style={{ display: "grid", gap: 2 }}>
          {categories.map((cat) => {
            const selected = cat.id === selectedId;
            const meta = [cat.type[0] ?? null, cat.id === lastUsedId ? "Last used" : null].filter(Boolean).join(" / ");
            return (
              <button className="picker-option" aria-pressed={selected} key={cat.id} onClick={() => { if (!selected) haptic("selection"); onSelect(cat); }} style={optionRowStyle(selected)}>
                <div style={pickerIconStyle}>{cat.icon ?? "#"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: selected ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                  {meta && <div style={pickerMetaStyle}>{meta}</div>}
                </div>
                {cat.available !== null && (
                  <span style={{ ...monoSmallStyle, color: cat.available > 0 ? "var(--success)" : "var(--danger)", paddingLeft: 8 }}>
                    {cat.available > 0 ? "+" : ""}<Money value={cat.available} />
                  </span>
                )}
              </button>
            );
          })}
          {categories.length === 0 && (
            <p style={{ padding: 18, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>No categories found</p>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 10px 11px", borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)", background: "color-mix(in srgb, var(--surface2) 10%, var(--surface))" }}>
        <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid transparent", background: "color-mix(in srgb, var(--surface2) 42%, var(--surface))", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
          <span aria-hidden="true" style={{ fontSize: 12, color: "var(--muted)" }}>/</span>
          <input type="text" aria-label="Search categories" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search categories" autoFocus style={{ width: "100%", background: "transparent", border: "none", padding: 0, color: "var(--text2)", outline: "none", fontSize: 16 }} />
        </div>
      </div>
    </div>
  );
}

/** Filters categories by name, the way both composers search. */
export function filterCategories(categories: Category[], search: string): Category[] {
  const needle = search.trim().toLowerCase();
  return needle ? categories.filter((cat) => cat.name.toLowerCase().includes(needle)) : categories;
}

/* ─── Composer picker chip (quiet outlined pill) ──────────────────── */

export const pickerChipStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 0,
  maxWidth: "100%",
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: "var(--surface)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

export const pickerChipIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  flexShrink: 0,
};

export const pickerChipLabelStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: 128,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/* ─── Option rows ─────────────────────────────────────────────────── */

const optionRowStyle = (selected: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 54,
  padding: "12px 14px",
  border: "none",
  borderRadius: 16,
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
  boxSizing: "border-box",
  background: selected ? "color-mix(in srgb, var(--accent) 11%, var(--surface))" : "transparent",
  boxShadow: selected ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
});

export const pickerIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 15,
};

const pickerMetaStyle: CSSProperties = {
  marginTop: 3,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const monoSmallStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  flexShrink: 0,
};
