"use client";

import { forwardRef, type CSSProperties } from "react";
import { SearchIcon, XIcon } from "./icons";

export const SearchField = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder: string;
  ariaLabel: string;
}>(function SearchField({ value, onChange, onClose, placeholder, ariaLabel }, ref) {
  return (
    <label style={wrapStyle}>
      <SearchIcon size={15} aria-hidden="true" style={{ color: "var(--muted)", flexShrink: 0 }} />
      <input
        ref={ref}
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      <button type="button" onClick={onClose} aria-label={`Close ${ariaLabel.toLowerCase()}`} style={closeStyle}>
        <XIcon size={16} aria-hidden="true" />
      </button>
    </label>
  );
});

const wrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 44,
  padding: "0 0 0 12px",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border2)",
  background: "var(--surface)",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  color: "var(--text)",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  outline: "none",
};

const closeStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: 0,
  borderRadius: "var(--radius-control)",
  background: "transparent",
  color: "var(--muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
