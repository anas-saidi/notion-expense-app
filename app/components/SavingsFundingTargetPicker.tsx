"use client";
import { LiquidButton } from "./ui/LiquidGlass";
import { useEffect, useRef, useState } from "react";
import { PickerPopover } from "./PickerPopover";
import { pickerChipStyle } from "./TransactionPickers";
import { useAppHaptics } from "./ui/useAppHaptics";
import type { SavingsFundingTarget } from "../../lib/savings-funding";

export function SavingsFundingTargetPicker({ value, onChange, disabled }: { value: SavingsFundingTarget; onChange: (value: SavingsFundingTarget) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const { haptic } = useAppHaptics();
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const options = [["separate", "Separate savings"], ["shared", "Shared contribution"]] as const;
  return <div ref={anchor} style={{ position: "relative" }}>
    <LiquidButton type="button" disabled={disabled} style={pickerChipStyle} aria-haspopup="dialog" aria-expanded={open} aria-label={`Savings target: ${options.find(([target]) => target === value)![1]}`} onClick={() => setOpen(!open)}>Target</LiquidButton>
    <PickerPopover open={open} onClose={() => setOpen(false)} anchorRef={anchor} title="Savings target" zIndex={180} size="menu">
      <div className="picker-options">{options.map(([target, label]) => <button type="button" className="picker-option" key={target} aria-pressed={value === target} onClick={() => { if (value !== target) haptic("selection"); onChange(target); setOpen(false); anchor.current?.querySelector("button")?.focus(); }}>{label}</button>)}</div>
    </PickerPopover>
  </div>;
}
