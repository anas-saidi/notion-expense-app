"use client";
import { ChoicePicker } from "./ChoicePicker";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts }: { open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void }) {
  return <BottomSheet open={open} onClose={onClose} label="Settings" maxWidth="480px" panelStyle={{ background: "var(--bg)", borderRadius: "var(--radius-sheet)" }}>
    <div style={sheetContentStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}>Settings</h2>
        <button type="button" className="settings-close-button sheet-close-button" aria-label="Close settings" onClick={onClose}><XIcon size={20} /></button>
      </header>
      <section aria-label="Preferences" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Preferences</h3>
        <label style={settingRowStyle}>
          <span style={rowLabelStyle}>Appearance</span>
          <ChoicePicker aria-label="Appearance" value={theme} onChange={event => onSelectTheme(event.target.value as Theme)} style={appearanceTriggerStyle}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </ChoicePicker>
        </label>
      </section>
      {onOpenAccounts && <section aria-label="Finances" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Finances</h3>
        <button type="button" className="settings-navigation-row" onClick={onOpenAccounts} style={navigationRowStyle}>
          Accounts <ChevronRightIcon size={18} aria-hidden="true" />
        </button>
      </section>}
    </div>
  </BottomSheet>;
}

const sheetContentStyle = { padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 28 } as const;
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const titleStyle = { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700 } as const;
const sectionStyle = { display: "grid", gap: 10 } as const;
const sectionTitleStyle = { margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 500 } as const;
const settingRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 52 } as const;
const rowLabelStyle = { fontSize: 16, color: "var(--text)" } as const;
const appearanceTriggerStyle = { minHeight: 44, padding: "0 12px", background: "var(--surface2)", color: "var(--text2)", border: 0, borderRadius: "var(--radius-control)", fontSize: 14, fontWeight: 600 } as const;
const navigationRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 52, padding: 0, border: 0, background: "transparent", color: "var(--text)", fontSize: 16, cursor: "pointer", textAlign: "left" } as const;
