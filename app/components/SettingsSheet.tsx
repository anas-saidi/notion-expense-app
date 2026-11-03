"use client";
import { LiquidButton } from "./ui/LiquidGlass";
import { SheetHeader } from "./ui/SheetLayout";
import { ThemeToggle } from "./ui/ThemeToggle";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts, syncTimestamp, syncing = false, onSync }: { open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void; syncTimestamp?: string | null; syncing?: boolean; onSync?: () => void }) {
  return <BottomSheet open={open} onClose={onClose} label="Settings" size="standard" panelStyle={{ background: "var(--bg)", borderRadius: "var(--radius-sheet)" }}>
    <div className="sheet-body" style={sheetContentStyle}>
      <SheetHeader style={headerStyle}>
        <h2 style={titleStyle}>Settings</h2>
        <LiquidButton type="button" className="settings-close-button sheet-close-button" aria-label="Close settings" onClick={onClose}><XIcon size={20} /></LiquidButton>
      </SheetHeader>
      <section aria-label="Preferences" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Preferences</h3>
        <div style={settingRowStyle}>
          <span style={rowLabelStyle}>Appearance</span>
          <ThemeToggle theme={theme} onSelectTheme={onSelectTheme} />
        </div>
      </section>
      {onOpenAccounts && <section aria-label="Finances" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Finances</h3>
        {onOpenAccounts && <button type="button" className="settings-navigation-row" onClick={onOpenAccounts} style={navigationRowStyle}>
          Accounts <ChevronRightIcon size={18} aria-hidden="true" />
        </button>}

      </section>}
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
      <footer><a href="https://www.thiings.co/things" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 12, color: "var(--text2)", textUnderlineOffset: 3 }}>Images by Thiings</a></footer>
    </div>
  </BottomSheet>;
}

const sheetContentStyle = { padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 24 } as const;
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const titleStyle = { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 600 } as const;
const sectionStyle = { display: "grid", gap: 8 } as const;
const sectionTitleStyle = { margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 500 } as const;
const settingRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 48 } as const;
const rowLabelStyle = { fontSize: 16, color: "var(--text)" } as const;
const navigationRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 48, padding: 0, border: 0, background: "transparent", color: "var(--text)", fontSize: 16, cursor: "pointer", textAlign: "left" } as const;
