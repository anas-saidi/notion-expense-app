"use client";
import { CategoryIcon } from "./ui/CategoryIcon";
import { accountIconSource } from "../../lib/category-icons";

import type { CSSProperties } from "react";
import type { Account, Category } from "./app-types";
import { Money } from "./Money";
import { useAppHaptics } from "./ui/useAppHaptics";
import { SearchIcon } from "./ui/icons";
import { EmptyState } from "./ui/EmptyState";
import "./sheet-components.css";

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
            <button type="button" className="picker-option composer-option" aria-pressed={selected} key={acct.id} onClick={() => { if (!selected) haptic("selection"); onSelect(acct.id); }}>
              <div style={pickerIconStyle}><CategoryIcon icon={accountIconSource(acct.type)} size={24} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: selected ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</div>
                {acct.type && acct.type.toLowerCase() !== acct.label.toLowerCase() && <div style={pickerMetaStyle}>{acct.type}</div>}
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
            const type = cat.type[0] ?? null;
            const lastUsed = cat.id === lastUsedId;
            return (
              <button type="button" className="picker-option composer-option" aria-pressed={selected} key={cat.id} onClick={() => { if (!selected) haptic("selection"); onSelect(cat); }}>
                <div style={pickerIconStyle}><CategoryIcon icon={cat.icon} categoryName={cat.name} size={24} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: selected ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                  {(type || lastUsed) && <div style={{ ...pickerMetaStyle, display: "flex", gap: 8 }}>{type && <span>{type}</span>}{lastUsed && <span>Last used</span>}</div>}
                </div>
                {cat.available !== null && (
                  <span style={{ ...monoSmallStyle, color: cat.available < 0 ? "var(--danger)" : cat.available === 0 ? "var(--muted)" : "var(--text2)", paddingLeft: 8 }}>
                    <Money value={cat.available} />
                  </span>
                )}
              </button>
            );
          })}
          {categories.length === 0 && (
            <EmptyState announce>{search.trim() ? <>No categories match “{search.trim()}”.</> : "No categories."}</EmptyState>
          )}
        </div>
      </div>
      {/* The shared picker search (.picker-search, as in ChoicePicker) with a leading search icon. */}
      <div style={{ position: "relative" }}>
        <SearchIcon size={16} aria-hidden="true" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
        <input type="text" className="picker-search composer-picker-search" aria-label="Search categories" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search categories" autoFocus />
      </div>
    </div>
  );
}

/** Filters categories by name, the way both composers search. */
export function filterCategories(categories: Category[], search: string): Category[] {
  const needle = search.trim().toLowerCase();
  return needle ? categories.filter((cat) => cat.name.toLowerCase().includes(needle)) : categories;
}

/* ─── Composer picker chip (shared glass material) ──────────────────── */
/* The composer chips are now ScreenChip mode="action" (design.md, Composer picker chip). These styles remain
   only for callers outside the composer that have not moved to ScreenChip yet. */

export const pickerChipStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 0,
  maxWidth: "100%",
  padding: "0 12px",
  borderRadius: 999,
  border: 0,
  background: "var(--lg-glass)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
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

export const optionRowStyle = (selected: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  padding: 12,
  border: "none",
  borderRadius: "var(--radius-control)",
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
  boxSizing: "border-box",
  background: selected ? "var(--select-wash)" : "transparent",
  boxShadow: selected ? "inset 0 0 0 1px var(--select-edge)" : "none",
});

export const pickerIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "var(--radius-control)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 15,
};

const pickerMetaStyle: CSSProperties = {
  marginTop: 4,
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
