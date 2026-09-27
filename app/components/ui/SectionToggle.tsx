"use client";

import type { CSSProperties } from "react";
import { fmt } from "../app-utils";
import { ChevronDownIcon } from "./icons";

/**
 * A collapsible section header: label, count, optional total and a chevron.
 * The plan sheet and the Budget tab list categories under the same headers.
 */
export function SectionToggle({ id, label, count, total, open, onToggle }: {
  id: string;
  label: string;
  count: number;
  /** Hidden when zero. */
  total?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} style={toggleStyle}>
      <h2 id={id} style={titleStyle}>
        {label} <span style={countStyle}>{count}</span>
      </h2>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {total !== undefined && Math.round(total) !== 0 && <span style={totalStyle}>{fmt(Math.round(total))}</span>}
        <ChevronDownIcon size={16} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", color: "var(--muted)" }} />
      </span>
    </button>
  );
}

const toggleStyle: CSSProperties = {
  minHeight: 44,
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 4px",
  cursor: "pointer",
  width: "100%",
  fontFamily: "var(--font-body)",
};
const countStyle: CSSProperties = { fontWeight: 600, color: "var(--muted)", marginLeft: 2 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text2)" };
const totalStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--muted)", fontVariantNumeric: "tabular-nums" };
