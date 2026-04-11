import type { CSSProperties } from "react";
import { Money } from "../Money";
import { TargetInput } from "./TargetInput";

type BudgetRowProps = {
  name: string;
  icon?: string | null;
  lastMonthSpent?: number | null;
  available?: number | null;
  isFunded?: boolean;
  value: number;
  ariaLabel: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLInputElement>) => void;
};

export function BudgetRow({
  name,
  icon,
  lastMonthSpent,
  available,
  isFunded = false,
  value,
  ariaLabel,
  onChange,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: BudgetRowProps) {
  const spent = Math.max(0, value - (available ?? value));
  const spentPct = Math.min(100, (spent / Math.max(1, value)) * 100);

  return (
    <div style={rowStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "var(--text)", fontSize: 15 }}>
          {icon ? `${icon} ` : ""}{name}
        </strong>
        <div style={metaRowStyle}>
          {(lastMonthSpent ?? 0) > 0 && (
            <span style={lastMonthStyle}>Last month <Money value={lastMonthSpent ?? 0} /></span>
          )}
          {isFunded && <span style={fundedStyle}>Funded</span>}
        </div>
      </div>
      <div style={inputWrapStyle}>
        <TargetInput
          value={value}
          nowValue={available ?? 0}
          ariaLabel={ariaLabel}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
        <div style={spentBarTrackStyle} aria-hidden="true">
          <div style={{ ...spentBarFillStyle, width: `${spentPct}%` }} />
        </div>
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px",
  gap: 12,
  alignItems: "start",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
};

const inputWrapStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
};

const metaLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const lastMonthStyle: CSSProperties = {
  ...metaLabelStyle,
};

const fundedStyle: CSSProperties = {
  ...metaLabelStyle,
  color: "color-mix(in srgb, var(--accent) 70%, var(--text))",
  marginLeft: "auto",
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "var(--accent-dim)",
};

const spentBarTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  overflow: "hidden",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const spentBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 65%, #d8f3c9)",
  transition: "width 0.18s ease",
};
