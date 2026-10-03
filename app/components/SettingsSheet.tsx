"use client";
import { ThemeToggle } from "./ui/ThemeToggle";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts, syncTimestamp, syncing = false, onSync }: { open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void; syncTimestamp?: string | null; syncing?: boolean; onSync?: () => void }) {
  return <BottomSheet open={open} onClose={onClose} label="Settings" maxWidth="480px" panelStyle={{ background: "var(--bg)", borderRadius: "var(--radius-sheet)" }}>
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
      {syncTimestamp && onSync && <section aria-label="Notion sync" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Notion sync</h3>
        <div style={settingRowStyle}>
          <div role="status" aria-live="polite" style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={rowLabelStyle}>{syncing ? "Syncing from Notion" : "Last synced"}</span>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>{new Date(syncTimestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <button type="button" disabled={syncing} onClick={onSync} style={{ minHeight: 44, padding: "0 8px", flexShrink: 0, border: 0, background: "transparent", color: "var(--text)", font: "inherit", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.5 : 1 }}>Sync now</button>
        </div>
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
const navigationRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 52, padding: 0, border: 0, background: "transparent", color: "var(--text)", fontSize: 16, cursor: "pointer", textAlign: "left" } as const;
