"use client";
import { useEffect, useState } from "react";
import type { BudgetScope } from "./app-types";
import { calculateWorkRate, readWorkConfig, saveWorkConfig, useWorkRates, type PayInput, type PayFrequency } from "./work-time";
import { ThemeToggle } from "./ui/ThemeToggle";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts, syncTimestamp, syncing = false, onSync, workScope, budgetScope }: { budgetScope: BudgetScope; workScope?: BudgetScope; open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void; syncTimestamp?: string | null; syncing?: boolean; onSync?: () => void }) {
  const rates = useWorkRates();
  const [editingScope, setEditingScope] = useState<BudgetScope | null>(null);
  const [draft, setDraft] = useState("");
  const [method, setMethod] = useState<"salary" | "hourly">("salary");
  const [people, setPeople] = useState<PayInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const startEditing = (scope: BudgetScope) => {
    const saved = readWorkConfig(scope);
    setDraft(saved ? String(saved.rate) : "");
    setMethod(saved?.method || "salary");
    setPeople(Array.from({ length: scope === "joint" ? 2 : 1 }, (_, index) => saved?.people?.[index] || { pay: "", hours: "", frequency: "monthly" }));
    setError(null);
    setEditingScope(scope);
  };
  useEffect(() => {
    if (open && workScope) startEditing(workScope);
    else setEditingScope(null);
  }, [open, workScope]);
  const finishEditing = () => { setEditingScope(null); if (workScope) onClose(); };
  const save = (remove = false) => {
    if (!editingScope) return;
    const value = method === "salary" ? calculateWorkRate(people) : draft.trim() ? Number(draft) : null;
    if (!remove && (value === null || !Number.isFinite(value) || value <= 0)) { setError(method === "salary" ? "Enter positive take-home pay and weekly hours for each person. Weekly hours cannot exceed 168." : "Enter a positive hourly rate."); return; }
    try { saveWorkConfig(editingScope, remove ? null : { rate: value!, method, ...(method === "salary" ? { people } : {}) }); finishEditing(); }
    catch { setError("Could not save on this device. Try again."); }
  };
  const calculatedRate = calculateWorkRate(people);
  const updatePerson = (index: number, patch: Partial<PayInput>) => { setPeople(current => current.map((person, i) => i === index ? { ...person, ...patch } : person)); setError(null); };
  const scopeName = (scope: BudgetScope) => scope === "joint" ? "Joint" : scope === "anas" ? "Anas" : "Salma";
  return <BottomSheet open={open} onClose={onClose} label={editingScope ? "Work & income" : "Settings"} maxWidth="480px" panelStyle={{ background: "var(--bg)", borderRadius: "var(--radius-sheet)" }}>
    {editingScope ? <form onSubmit={event => { event.preventDefault(); save(); }} style={sheetContentStyle}>
      <header style={headerStyle}>
        {!workScope && <button type="button" className="sheet-close-button" aria-label="Back to Settings" onClick={finishEditing}><ChevronLeftIcon size={20} /></button>}
        <h2 style={titleStyle}>Work & income</h2>
        <button type="button" className="sheet-close-button" aria-label="Close work and income" onClick={onClose}><XIcon size={20} /></button>
      </header>
      <div style={{ display: "grid", gap: 16 }}>
        {method === "salary" ? <>
          {people.map((person, index) => <fieldset key={index} style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12, minWidth: 0 }}>
            <legend style={{ ...rowLabelStyle, padding: "0 0 12px", fontWeight: 500 }}>{editingScope === "joint" ? index === 0 ? "Anas" : "Salma" : scopeName(editingScope)}</legend>
            <label style={fieldLabelStyle}><span>Take-home pay</span><div style={{ display: "flex", gap: 12, alignItems: "center" }}><input className="field-input" inputMode="decimal" value={person.pay} placeholder="0" aria-label={`${editingScope === "joint" ? index === 0 ? "Anas" : "Salma" : scopeName(editingScope)} take-home pay`} onChange={event => updatePerson(index, { pay: event.target.value })} /><span>MAD</span></div></label>
            <label style={fieldLabelStyle}><span>Pay frequency</span><select className="field-input" value={person.frequency} onChange={event => updatePerson(index, { frequency: event.target.value as PayFrequency })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option></select></label>
            <label style={fieldLabelStyle}><span>Hours worked per week</span><input className="field-input" inputMode="decimal" value={person.hours} placeholder="40" onChange={event => updatePerson(index, { hours: event.target.value })} /></label>
          </fieldset>)}
          <p aria-live="polite" style={{ margin: 0, fontSize: 15, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{calculatedRate === null ? "Your hourly rate will appear here." : `${editingScope === "joint" ? "Your household’s" : "Your"} hourly rate is ${calculatedRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD`}</p>
        </> : <>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={sectionTitleStyle}>Take-home hourly rate</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input className="field-input" aria-label={`${scopeName(editingScope)} take-home hourly rate`} aria-invalid={!!error} aria-describedby={error ? "hourly-rate-error" : undefined} inputMode="decimal" placeholder="0" value={draft} onChange={event => { setDraft(event.target.value); setError(null); }} style={{ flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" }} />
            <span style={{ fontSize: 13, color: "var(--text2)", whiteSpace: "nowrap" }}>MAD/hour</span>
          </div>
        </label>
        </>}
        <button type="button" onClick={() => { setMethod(current => current === "salary" ? "hourly" : "salary"); setError(null); if (method === "salary" && calculatedRate !== null) setDraft(String(calculatedRate)); }} style={{ ...navigationRowStyle, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>{method === "salary" ? "Enter hourly rate instead" : "Calculate from salary instead"}</button>
        {error && <p id="hourly-rate-error" role="alert" style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Saved on this device.</p>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="submit" style={saveButtonStyle}>Save</button>
        {rates[editingScope] !== undefined && <button type="button" onClick={() => save(true)} style={{ ...navigationRowStyle, justifyContent: "center", fontSize: 14 }}>Remove rate</button>}
      </div>
    </form> :
    <div style={sheetContentStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}>Settings</h2>
        <button type="button" className="settings-close-button sheet-close-button" aria-label="Close settings" onClick={onClose}><XIcon size={20} /></button>
      </header>
      <section aria-label="Preferences" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Preferences</h3>
        <div style={settingRowStyle}>
          <span style={rowLabelStyle}>Appearance</span>
          <ThemeToggle theme={theme} onSelectTheme={onSelectTheme} />
        </div>
      </section>
      {onOpenAccounts && <section aria-label="Finances" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Finances</h3>
        <button type="button" className="settings-navigation-row" onClick={onOpenAccounts} style={navigationRowStyle}>
          Accounts <ChevronRightIcon size={18} aria-hidden="true" />
        </button>
      </section>}
      <button type="button" className="settings-navigation-row" onClick={() => startEditing(budgetScope)} style={navigationRowStyle}>
        <span>Work & income</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>{rates[budgetScope] !== undefined ? `${rates[budgetScope]!.toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD/hour` : "Not set"}</span>
          <ChevronRightIcon size={18} aria-hidden="true" />
        </span>
      </button>
      {onSync && <section aria-label="Notion sync" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Notion sync</h3>
        <div style={settingRowStyle}>
          <div role="status" aria-live="polite" style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={rowLabelStyle}>{syncing ? "Syncing from Notion" : syncTimestamp ? "Last synced" : "Refresh from Notion"}</span>
            {syncTimestamp && <span style={{ fontSize: 13, color: "var(--text2)" }}>{new Date(syncTimestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
          </div>
          <button type="button" disabled={syncing} onClick={onSync} style={{ minHeight: 44, padding: "0 8px", flexShrink: 0, border: 0, background: "transparent", color: "var(--text)", font: "inherit", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.5 : 1 }}>Sync now</button>
        </div>
      </section>}
    </div>}
  </BottomSheet>;
}

const sheetContentStyle = { padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 28 } as const;
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const titleStyle = { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700 } as const;
const sectionStyle = { display: "grid", gap: 10 } as const;
const sectionTitleStyle = { margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 500 } as const;
const settingRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 52 } as const;
const rowLabelStyle = { fontSize: 16, color: "var(--text)" } as const;
const navigationRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 52, padding: 0, border: 0, background: "transparent", color: "var(--text)", fontSize: 16, cursor: "pointer", textAlign: "left" } as const;

const saveButtonStyle = { minHeight: 44, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", font: "inherit", cursor: "pointer" } as const;

const fieldLabelStyle = { display: "grid", gap: 8, fontSize: 13, color: "var(--text2)" } as const;
