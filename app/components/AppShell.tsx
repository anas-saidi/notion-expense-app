import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AppTab, BudgetScope } from "./app-types";
import { BottomNav } from "./BottomNav";
import { PlusIcon, SearchIcon, SettingsIcon, ShuffleIcon } from "./ui/icons";
import { GlobalBudgetScopePicker } from "./ui/ScopeChipBar";
import { SettingsSheet } from "./SettingsSheet";

export function AppShell({
  tab,
  pendingCount = 0,
  onTabChange,
  onOpenAdd,
  onOpenManage,
  budgetScope,
  onBudgetScopeChange,
  personalScope,
  onBudgetSearch,
  onInsightsSearch,
  onBudgetRebalance,
  theme = "light",
  onSelectTheme,
  toast,
  showAddButton = true,
  immersive = false,
  hideHeader = false,
  children,
}: {
  tab: AppTab;
  pendingCount?: number;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  onOpenManage?: () => void;
  budgetScope: BudgetScope;
  onBudgetScopeChange: (scope: BudgetScope) => void;
  personalScope: Exclude<BudgetScope, "joint">;
  onBudgetSearch?: () => void;
  onInsightsSearch?: () => void;
  onBudgetRebalance?: () => void;
  theme?: "system" | "light" | "dark";
  onSelectTheme?: (theme: "system" | "light" | "dark") => void;
  toast?: string | null;
  showAddButton?: boolean;
  immersive?: boolean;
  hideHeader?: boolean;
  children?: ReactNode;
}) {
  // On desktop (≥ 1100px) the sidebar is always visible — immersive mode only
  // applies on mobile where the bottom nav needs to be hidden.
  const [isDesktop, setIsDesktop] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1100);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const useKeyboardModality = (event: KeyboardEvent) => {
      if (event.key === "Tab") root.dataset.inputModality = "keyboard";
    };
    const usePointerModality = () => {
      root.dataset.inputModality = "pointer";
    };
    window.addEventListener("keydown", useKeyboardModality, true);
    window.addEventListener("pointerdown", usePointerModality, true);
    return () => {
      window.removeEventListener("keydown", useKeyboardModality, true);
      window.removeEventListener("pointerdown", usePointerModality, true);
      delete root.dataset.inputModality;
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      content.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  // effectiveImmersive drives layout/nav; the original immersive drives header visibility.
  const effectiveImmersive = immersive && !isDesktop;

  return (
    <div className="app-shell-root" style={{ height: "100dvh", position: "relative" }}>
      <div
        ref={contentRef}
        id={!effectiveImmersive ? "app-root-shell" : undefined}
        className={effectiveImmersive ? undefined : "app-content"}
        style={effectiveImmersive ? { height: "100%" } : { height: "100%", overflowY: "auto", overflowAnchor: "none", position: "relative" }}
      >
        {!immersive && !hideHeader && (
          <header className="app-header" style={headerStyle}>
            <GlobalBudgetScopePicker value={budgetScope} onChange={onBudgetScopeChange} personalScope={personalScope} />
            <div className="app-header-actions">
              {tab === "budget" ? (
                <>
                  <button className="app-top-action" type="button" onClick={onBudgetSearch} aria-label="Search categories" style={menuButtonStyle}>
                    <SearchIcon size={18} />
                  </button>
                  <button className="app-top-action" type="button" onClick={onBudgetRebalance} aria-label="Rebalance budget" style={menuButtonStyle}>
                    <ShuffleIcon size={18} />
                  </button>
                </>
              ) : tab === "history" ? (
                <>
                  <button className="app-top-action" type="button" onClick={onInsightsSearch} aria-label="Search activity" style={menuButtonStyle}>
                    <SearchIcon size={18} />
                  </button>
                  {onSelectTheme && (
                    <button className="app-top-action" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" style={menuButtonStyle}>
                      <SettingsIcon size={18} />
                    </button>
                  )}
                </>
              ) : onSelectTheme && (
                <button className="app-top-action" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" style={menuButtonStyle}>
                  <SettingsIcon size={18} />
                </button>
              )}
            </div>
          </header>
        )}
        {children}
      </div>

      {!effectiveImmersive && (
        <div className="app-nav-wrap">
          <BottomNav tab={tab} pendingCount={pendingCount} onTabChange={onTabChange} />

          {showAddButton && (
            <button
              onClick={onOpenAdd}
              className="fab-add app-nav-add"
              aria-label="Add transaction"
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                border: "1px solid var(--text)",
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "var(--elevation-float)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PlusIcon size={22} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {onSelectTheme && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onSelectTheme={onSelectTheme}
          onOpenAccounts={onOpenManage ? () => {
            setSettingsOpen(false);
            onOpenManage();
          } : undefined}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="app-toast"
          style={{
            position: "fixed",
            left: "50%",
            bottom: effectiveImmersive ? "calc(20px + env(safe-area-inset-bottom, 0px))" : "calc(64px + env(safe-area-inset-bottom, 0px))",
            transform: "translateX(-50%)",
            zIndex: 80,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            color: "var(--text2)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "var(--font-body)",
            letterSpacing: 0.4,
            boxShadow: "var(--elevation-float)",
            animation: "toastIn 0.2s ease both",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const menuButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: "var(--surface)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: "none",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 16,
};
