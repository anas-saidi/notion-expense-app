"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { IncomeUse } from "@/lib/joint-income";
import { PickerPopover } from "./PickerPopover";
import { optionRowStyle, pickerChipStyle, pickerChipIconStyle, pickerChipLabelStyle } from "./TransactionPickers";
import { TargetIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";

const options = [
  ["contributions", "Cover contributions"],
  ["unassigned", "Keep unassigned"],
] as const;

export function IncomeUseControl({ value, onChange, disabled = false, onOpen, dismiss = false }: {
  value: IncomeUse; onChange: (value: IncomeUse) => void; disabled?: boolean;
  onOpen?: () => void; dismiss?: boolean;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { haptic } = useAppHaptics();
  useEffect(() => { if (disabled || dismiss) setOpen(false); }, [disabled, dismiss]);
  const selectedLabel = options.find(([use]) => use === value)![1];
  return (
    <div ref={anchorRef} style={{ position: "relative", minWidth: 0 }}>
      <button type="button" disabled={disabled} aria-label={`How to use this income: ${selectedLabel}`} title={`Target: ${selectedLabel}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        style={{ ...pickerChipStyle, color: open ? "var(--text2)" : "var(--muted)", opacity: disabled ? 0.5 : 1 }}
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>
        <span style={pickerChipIconStyle}><TargetIcon size={18} aria-hidden="true" /></span>
        <span style={pickerChipLabelStyle}>Target</span>
      </button>
      <PickerPopover open={open} title="How to use this income" onClose={() => setOpen(false)} anchorRef={anchorRef} placement="top" width="min(300px, calc(100vw - 28px))" zIndex={140}>
        <div id={id} style={{ padding: 8, display: "grid", gap: 2 }}>
          {options.map(([use, label]) => {
            const selected = value === use;
            return (
              <button type="button" key={use} className="picker-option" aria-pressed={selected} style={optionRowStyle(selected)} onClick={() => {
                if (!selected) haptic("selection");
                onChange(use); setOpen(false); anchorRef.current?.querySelector("button")?.focus();
              }}>
                <span style={{ fontWeight: selected ? 600 : 500 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </PickerPopover>
    </div>
  );
}
