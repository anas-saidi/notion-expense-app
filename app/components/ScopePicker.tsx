import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BudgetScope } from "./app-types";
import { BUDGET_SCOPE_LABELS } from "./app-utils";
import { ChevronDownIcon } from "./ui/icons";

type ScopePickerProps = {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
};

const SCOPES: BudgetScope[] = ["joint", "anas", "salma"];

export function ScopePicker({ value, onChange }: ScopePickerProps) {
  const [open, setOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="view-picker"
      data-view={value}
      style={wrapStyle}
    >
      <button
        type="button"
        key={pulseKey}
        className="view-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Budget view"
        onClick={() => setOpen((current) => !current)}
        style={{
          ...triggerStyle,
          ...triggerToneStyle(value),
        }}
      >
        <span style={triggerTextStyle}>{BUDGET_SCOPE_LABELS[value]}</span>
        <ChevronDownIcon
          size={14}
          aria-hidden="true"
          style={{
            ...iconStyle,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div role="listbox" aria-label="Budget view" className="view-picker__menu" style={menuStyle}>
          {SCOPES.map((scope) => {
            const active = scope === value;
            return (
              <button
                key={scope}
                type="button"
                role="option"
                aria-selected={active}
                className={active ? "view-picker__option view-picker__option--active" : "view-picker__option"}
                onClick={() => {
                  if (scope !== value) setPulseKey((current) => current + 1);
                  onChange(scope);
                  setOpen(false);
                }}
                style={{
                  ...optionStyle,
                  ...(active ? optionActiveStyle : null),
                }}
              >
                <span
                  className={active ? "view-picker__dot view-picker__dot--active" : "view-picker__dot"}
                  style={{ ...dotStyle, background: dotColor(scope) }}
                />
                <span style={optionTextStyle}>{BUDGET_SCOPE_LABELS[scope]}</span>
                {active && <span style={activeMarkStyle}>Selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "relative",
  minHeight: 44,
  minWidth: 126,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 58%, transparent)",
  background: "color-mix(in srgb, var(--surface) 88%, var(--surface2))",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  boxShadow:
    "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent), inset 0 1px 0 color-mix(in srgb, white 56%, transparent)",
  overflow: "visible",
};

const triggerStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 34px 0 13px",
  borderRadius: 14,
  background: "transparent",
  border: "none",
  color: "var(--text)",
  cursor: "pointer",
  display: "grid",
  justifyItems: "start",
  alignContent: "center",
  lineHeight: 1,
  textAlign: "left",
};

const triggerToneStyle = (scope: BudgetScope): CSSProperties => ({
  color:
    scope === "salma"
      ? "var(--partner-wife-strong)"
      : scope === "anas"
        ? "var(--partner-husband-strong)"
        : "var(--text)",
});

const triggerTextStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 760,
};

const iconStyle: CSSProperties = {
  position: "absolute",
  right: 11,
  top: 15,
  pointerEvents: "none",
  color: "var(--muted)",
  transition: "transform 0.16s ease",
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: 176,
  padding: 6,
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border2) 60%, transparent)",
  background: "var(--surface)",
  boxShadow:
    "0 18px 36px color-mix(in srgb, var(--ink-strong) 14%, transparent), inset 0 1px 0 color-mix(in srgb, white 55%, transparent)",
  zIndex: 80,
  display: "grid",
  gap: 3,
  animation: "fadeUp 0.16s ease both",
};

const optionStyle: CSSProperties = {
  minHeight: 44,
  width: "100%",
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "8px 1fr auto",
  alignItems: "center",
  gap: 9,
  padding: "0 10px",
  textAlign: "left",
};

const optionActiveStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
};

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
};

const optionTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const activeMarkStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 8,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const dotColor = (scope: BudgetScope) => {
  if (scope === "salma") return "var(--partner-wife)";
  if (scope === "anas") return "var(--partner-husband)";
  return "var(--text)";
};
