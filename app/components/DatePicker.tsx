"use client";
import { useRef, useState, type InputHTMLAttributes, type ChangeEvent, type CSSProperties } from "react";
import { PickerPopover } from "./PickerPopover";
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "./ui/icons";
import { today } from "./app-utils";
export function DateCalendar({ value, onChange, max }: { value: string; onChange: (value: string) => void; max?: string }) {
  const [month, setMonth] = useState(() => (value || today()).slice(0,7));
  const [year, number] = month.split("-").map(Number);
  const first = new Date(year, number - 1, 1);
  const days = new Date(year, number, 0).getDate();
  const todayValue = today();
  const move = (delta: number) => { const date = new Date(year, number - 1 + delta, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`); };
  return <div className="date-calendar">
    <div className="date-month"><button type="button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeftIcon /></button><strong aria-live="polite">{first.toLocaleDateString(undefined,{ month: "long", year: "numeric" })}</strong><button type="button" aria-label="Next month" onClick={() => move(1)}><ChevronRightIcon /></button></div>
    <div className="date-grid">{["M","T","W","T","F","S","S"].map((day,i) => <span key={i} aria-hidden="true">{day}</span>)}{Array.from({length:(first.getDay()+6)%7},(_,i)=><span key={`blank-${i}`} />)}{Array.from({length:days},(_,i)=> { const date = `${month}-${String(i+1).padStart(2,"0")}`; return <button type="button" key={date} aria-label={new Date(year,number-1,i+1).toLocaleDateString(undefined,{dateStyle:"full"})} aria-current={date === todayValue ? "date" : undefined} aria-pressed={date === value} disabled={!!max && date > max} onClick={() => onChange(date)}>{i+1}</button>; })}</div>
  </div>;
}
type PickerInputProps = InputHTMLAttributes<HTMLInputElement> & { placement?: "top" | "bottom"; align?: "left" | "right" };
export function DatePicker({value,onChange,max,style,placement="bottom",align="left",...rest}: PickerInputProps) {
  const [open,setOpen] = useState(false); const anchor = useRef<HTMLSpanElement>(null);
  const selected = String(value || today());
  return <span ref={anchor} className="date-picker-anchor"><PickerTrigger label={new Date(`${selected}T12:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})} open={open} style={style} ariaLabel={String(rest["aria-label"] ?? "Choose date")} onClick={()=>setOpen(!open)} /><PickerPopover open={open} anchorRef={anchor} title="Choose date" onClose={()=>setOpen(false)} placement={placement} align={align} zIndex={180} width="min(304px, calc(100vw - 32px))"><DateCalendar value={selected} max={max ? String(max) : undefined} onChange={next=>{onChange?.({target:{value:next},currentTarget:{value:next}} as ChangeEvent<HTMLInputElement>);setOpen(false);}}/></PickerPopover></span>;
}

export function MonthPicker({value,onChange,max,min,style,...rest}: InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  const selected = String(value || today().slice(0, 7));
  const [year, month] = selected.split("-").map(Number);
  const label = new Date(year, Math.max(0, (month || 1) - 1), 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const openNativePicker = () => { if (!input.current) return; if (typeof input.current.showPicker === "function") input.current.showPicker(); else input.current.click(); };
  return <span className="date-picker-anchor"><PickerTrigger label={label} open={false} style={style} ariaLabel={String(rest["aria-label"] ?? "Choose month")} onClick={openNativePicker} /><input ref={input} type="month" value={selected} min={min} max={max} onChange={onChange} className="date-picker-native-input" tabIndex={-1} aria-hidden="true" /></span>;
}

export function DatePickerTrigger({ label, open, style, ariaLabel, onClick, className = "", showChevron = true }: { label: string; open: boolean; style?: CSSProperties; ariaLabel: string; onClick: () => void; className?: string; showChevron?: boolean }) {
  return <button type="button" className={`choice-trigger date-picker-trigger ${className}`.trim()} style={style} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={onClick}><CalendarIcon size={16} aria-hidden="true" /><span>{label}</span>{showChevron && <ChevronDownIcon size={14} aria-hidden="true" className={open ? "date-picker-chevron date-picker-chevron--open" : "date-picker-chevron"} />}</button>;
}

const PickerTrigger = DatePickerTrigger;
