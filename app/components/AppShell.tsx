import { type ReactNode } from "react";
import type { AppTab, BudgetScope } from "./app-types";
import { BottomNav } from "./BottomNav";
import { ScopePicker } from "./ScopePicker";
import { MenuIcon, PlusIcon } from "./ui/icons";

export function AppShell({
  tab,
  pendingCount = 0,
  onTabChange,
  onOpenAdd,
  onOpenManage,
  budgetScope,
  onBudgetScopeChange,
  toast,
  showAddButton = true,
  immersive = false,
  children,
}: {
  tab: AppTab;
  pendingCount?: number;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  onOpenManage?: () => void;
  budgetScope: BudgetScope;
  onBudgetScopeChange: (scope: BudgetScope) => void;
  toast?: string | null;
  showAddButton?: boolean;
  immersive?: boolean;
  children?: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div
        id={!immersive ? "app-root-shell" : undefined}
        className={immersive ? undefined : "app-content"}
        style={immersive ? { minHeight: "100dvh" } : { position: "relative" }}
      >
        {!immersive && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ minWidth: 0, display: "flex", alignItems: "center" }}>
              {onOpenManage && (
                <button type="button" onClick={onOpenManage} aria-label="Open management menu" style={menuButtonStyle}>
                  <MenuIcon size={18} />
                </button>
              )}
            </div>
            <ScopePicker value={budgetScope} onChange={onBudgetScopeChange} />
          </div>
        )}
        {children}
      </div>

      {!immersive && (
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
            </button>
          )}
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: immersive ? "calc(20px + env(safe-area-inset-bottom, 0px))" : "calc(64px + env(safe-area-inset-bottom, 0px))",
            transform: "translateX(-50%)",
            zIndex: 80,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            color: "var(--text)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
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
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 50%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
