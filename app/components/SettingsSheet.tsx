"use client";
import { Button } from "./ui/Button";
import "./sheet-components.css";
import { SheetHeader } from "./ui/SheetLayout";
import { ThemeToggle } from "./ui/ThemeToggle";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";
type Theme = "system" | "light" | "dark";
export function SettingsSheet({ open, onClose, theme, onSelectTheme, onOpenAccounts, syncTimestamp, syncing = false, onSync }: { open: boolean; onClose: () => void; theme: Theme; onSelectTheme: (theme: Theme) => void; onOpenAccounts?: () => void; syncTimestamp?: string | null; syncing?: boolean; onSync?: () => void }) {
  return <BottomSheet open={open} onClose={onClose} label="Settings" size="standard">
    <div className="sheet-body" style={sheetContentStyle}>
      <SheetHeader style={headerStyle}>
        <h2 style={titleStyle}>Settings</h2>
        <button type="button" className="sheet-close-button" aria-label="Close settings" onClick={onClose}><XIcon size={20} /></button>
      </SheetHeader>
      <section aria-label="Preferences" style={sectionStyle}>
        <div style={settingRowStyle}>
          <span style={rowLabelStyle}>Appearance</span>
          <ThemeToggle theme={theme} onSelectTheme={onSelectTheme} />
        </div>
      </section>
      {onOpenAccounts && <section aria-label="Finances" style={sectionStyle}>
        {onOpenAccounts && <button type="button" className="settings-navigation-row" onClick={onOpenAccounts}>
          Accounts <ChevronRightIcon size={20} aria-hidden="true" />
        </button>}

      </section>}
      {onSync && <section aria-label="Notion sync" style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Notion sync</h3>
        <div style={settingRowStyle}>
          <div role="status" aria-live="polite" style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={rowLabelStyle}>{syncing ? "Syncing from Notion" : syncTimestamp ? "Last synced" : "Refresh from Notion"}</span>
            {syncTimestamp && <span style={{ fontSize: 13, color: "var(--text2)" }}>{new Date(syncTimestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
          </div>
          <Button variant="quiet" size="compact" loading={syncing} loadingLabel="Syncing" onClick={onSync} style={{ flexShrink: 0 }}>Sync now</Button>
        </div>
      </section>}
      <footer><a href="https://www.thiings.co/things" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 12, color: "var(--text2)", textUnderlineOffset: 3 }}>Images by Thiings</a></footer>
    </div>
  </BottomSheet>;
}

const sheetContentStyle = { padding: "16px 24px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 24 } as const;
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const titleStyle = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600 } as const;
const sectionStyle = { display: "grid", gap: 8 } as const;
const sectionTitleStyle = { margin: 0, fontSize: 13, lineHeight: "16px", color: "var(--muted)", fontWeight: 600 } as const;
const settingRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 48 } as const;
const rowLabelStyle = { fontSize: 15, lineHeight: "22px", color: "var(--text)" } as const;
