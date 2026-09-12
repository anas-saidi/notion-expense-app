"use client";
import { ChoicePicker } from "./ChoicePicker";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts }: { open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void }) {
  return <BottomSheet open={open} onClose={onClose} label="Settings" maxWidth="480px" panelStyle={{ background: "var(--bg)", borderRadius: "var(--radius-sheet)" }}>
    <div style={{ padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 24 }}>Settings</h2>
        <button type="button" aria-label="Close settings" onClick={onClose}><XIcon size={20} /></button>
      </header>
      <section aria-label="Preferences" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Preferences</h3>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 52, borderBottom: "1px solid var(--border)" }}>
          <span>Appearance</span>
          <ChoicePicker aria-label="Appearance" value={theme} onChange={event => onSelectTheme(event.target.value as Theme)} style={{ minHeight: 44, background: "var(--bg)", color: "var(--text2)", border: 0, fontSize: 15 }}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </ChoicePicker>
        </label>
      </section>
      {onOpenAccounts && <section aria-label="Finances" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Finances</h3>
        <button type="button" onClick={onOpenAccounts} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 52, padding: 0, border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 16, cursor: "pointer" }}>
          Accounts <ChevronRightIcon size={18} aria-hidden="true" />
        </button>
      </section>}
    </div>
  </BottomSheet>;
}
