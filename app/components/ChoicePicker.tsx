"use client";
import { Children, isValidElement, useRef, useState, type SelectHTMLAttributes, type ChangeEvent, type ReactNode } from "react";
import { PickerPopover } from "./PickerPopover";
import { CheckIcon, ChevronDownIcon } from "./ui/icons";
export function ChoicePicker({ children, value, onChange, style, disabled, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const anchor = useRef<HTMLSpanElement>(null);
  const options = Children.toArray(children).filter(isValidElement).map(child => (child.props as { value: string; children: ReactNode; disabled?: boolean }));
  const selected = options.find(option => String(option.value) === String(value));
  const title = rest["aria-label"] ?? "Choose an option";
  return <span ref={anchor} style={{ display: "block", minWidth: 0 }}>
    <button type="button" disabled={disabled} aria-label={rest["aria-label"]} aria-haspopup="dialog" aria-expanded={open} className="choice-trigger" style={style} onClick={() => { setSearch(""); setOpen(!open); }}>{selected?.children ?? "Choose"}<ChevronDownIcon size={16} /></button>
    <PickerPopover open={open} anchorRef={anchor} title={title} onClose={() => setOpen(false)} zIndex={180} width="min(340px, calc(100vw - 32px))">
      {options.length > 10 && <input className="picker-search" aria-label={`Search ${title}`} placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} />}
      <div className="picker-options">
        {options.filter(option => Children.toArray(option.children).join("").toLowerCase().includes(search.toLowerCase())).map((option, index) => <button className="picker-option" type="button" key={String(option.value) + index} disabled={option.disabled} aria-pressed={String(option.value) === String(value)} onClick={() => { onChange?.({ target: { value: String(option.value) }, currentTarget: { value: String(option.value) } } as ChangeEvent<HTMLSelectElement>); setOpen(false); anchor.current?.querySelector("button")?.focus(); }}><span>{option.children}</span>{String(option.value) === String(value) && <CheckIcon size={18} />}</button>)}
      </div>
    </PickerPopover>
  </span>;
}
