import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AppTab, BudgetScope } from "./app-types";
import { BottomNav } from "./BottomNav";
import { LandmarkIcon, MoonIcon, SunIcon, PlusIcon } from "./ui/icons";
import { GlobalBudgetScopePicker } from "./ui/ScopeChipBar";

export function AppShell({
  tab,
  pendingCount = 0,
  onTabChange,
  onOpenAdd,
  onOpenManage,
  budgetScope,
  onBudgetScopeChange,
  theme = "light",
  onToggleTheme,
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
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  toast?: string | null;
  showAddButton?: boolean;
  immersive?: boolean;
  hideHeader?: boolean;
  children?: ReactNode;
}) {
  // On desktop (≥ 1100px) the sidebar is always visible — immersive mode only
  // applies on mobile where the bottom nav needs to be hidden.
  const [isDesktop, setIsDesktop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1100);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
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
    <div className={`app-shell-root${tab === "home" ? " app-shell-root--home" : ""}`} style={{ height: "100dvh", position: "relative" }}>
      <div
        ref={contentRef}
        id={!effectiveImmersive ? "app-root-shell" : undefined}
        className={effectiveImmersive ? undefined : "app-content"}
        style={effectiveImmersive ? { height: "100%" } : { height: "100%", overflowY: "auto", overflowAnchor: "none", position: "relative" }}
      >
        {!immersive && !hideHeader && (
          <header className="app-header" style={headerStyle}>
            <GlobalBudgetScopePicker value={budgetScope} onChange={onBudgetScopeChange} />
            <div className="app-header-actions">
              {onToggleTheme && (
                <button className="app-top-action" type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={menuButtonStyle}>
                  {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                </button>
              )}
              {onOpenManage && (
                <button className="app-top-action" type="button" onClick={onOpenManage} aria-label="Accounts" style={menuButtonStyle}>
                  <LandmarkIcon size={18} />
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
              aria-label="Add expense"
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                background: "var(--accent)",
                color: "var(--accent-ink)",
                boxShadow:
                  "0 16px 30px color-mix(in srgb, var(--ink-strong) 12%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PlusIcon size={22} strokeWidth={2.5} />
              <span className="app-nav-add-label">Add</span>
            </button>
          )}
        </div>
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
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--ink-strong) 10%, transparent)",
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
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: "color-mix(in srgb, var(--surface) 88%, transparent)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: "0 7px 18px color-mix(in srgb, var(--ink-strong) 9%, transparent)",
  backdropFilter: "blur(18px) saturate(1.2)",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 24,
};
