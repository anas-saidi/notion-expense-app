import type { CSSProperties } from "react";
import { Money } from "../Money";

type TargetInputProps = {
  label?: string;
  nowValue?: number | null;
  value: number;
  placeholder?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLInputElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLInputElement>) => void;
};

export function TargetInput({
  label = "Target",
  nowValue,
  value,
  placeholder = "Set",
  ariaLabel,
  onChange,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TargetInputProps) {
  return (
    <div style={inputWrapStyle}>
      <div style={inputMetaStyle}>
        <span style={targetLabelStyle}>{label}</span>
        {typeof nowValue === "number" && (
          <span style={nowLabelStyle}>Now <Money value={nowValue} /></span>
        )}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={amountInputStyle}
      />
    </div>
  );
}

const inputWrapStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const inputMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 14,
};

const targetLabelStyle: CSSProperties = {
  fontSize: 10,
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "color-mix(in srgb, var(--text2) 86%, transparent)",
};

const nowLabelStyle: CSSProperties = {
  fontSize: 10,
  fontFamily: "'DM Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
};

const amountInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 16,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
  touchAction: "none",
};
