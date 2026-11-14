"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { IncomeUse } from "@/lib/joint-income";
import { PickerPopover } from "./PickerPopover";
import { ScreenChip } from "./ui/ScreenChip";
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
      <ScreenChip mode="action" icon={<TargetIcon size={16} />} disabled={disabled} ariaLabel={`Income use: ${selectedLabel}`} title={`Income use: ${selectedLabel}`} ariaHasPopup="dialog" ariaExpanded={open} ariaControls={open ? id : undefined}
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>
        {selectedLabel}
      </ScreenChip>
      <PickerPopover open={open} title="Income use" onClose={() => setOpen(false)} anchorRef={anchorRef} placement="top" size="choice" zIndex={140}>
        <div id={id} className="picker-options">
          {options.map(([use, label]) => {
            const selected = value === use;
            return (
              <button type="button" key={use} className="picker-option" aria-pressed={selected} onClick={() => {
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
