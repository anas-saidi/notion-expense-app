"use client";
import { useEffect, useId, useRef, useState } from "react";
import { PickerPopover } from "./PickerPopover";
import { ScreenChip } from "./ui/ScreenChip";
import { TargetIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";
import type { SavingsFundingTarget } from "../../lib/savings-funding";

/** Same anchored pattern as IncomeUseControl: an action chip that opens a two-option list. */
export function SavingsFundingTargetPicker({ value, onChange, disabled }: { value: SavingsFundingTarget; onChange: (value: SavingsFundingTarget) => void; disabled: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const { haptic } = useAppHaptics();
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const options = [["separate", "Separate savings"], ["shared", "Shared contribution"]] as const;
  const selectedLabel = options.find(([target]) => target === value)![1];
  return <div ref={anchor} style={{ position: "relative", minWidth: 0 }}>
    <ScreenChip mode="action" icon={<TargetIcon size={16} />} disabled={disabled} ariaHasPopup="dialog" ariaExpanded={open} ariaControls={open ? id : undefined} ariaLabel={`Savings target: ${selectedLabel}`} title={`Savings target: ${selectedLabel}`} onClick={() => setOpen(!open)}>{selectedLabel}</ScreenChip>
    <PickerPopover open={open} onClose={() => setOpen(false)} anchorRef={anchor} title="Savings target" zIndex={180} size="choice">
      <div id={id} className="picker-options">{options.map(([target, label]) => {
        const selected = value === target;
        return <button type="button" className="picker-option" key={target} aria-pressed={selected} onClick={() => { if (!selected) haptic("selection"); onChange(target); setOpen(false); anchor.current?.querySelector("button")?.focus(); }}>
          <span style={{ fontWeight: selected ? 600 : 500 }}>{label}</span>
        </button>;
      })}</div>
    </PickerPopover>
  </div>;
}
