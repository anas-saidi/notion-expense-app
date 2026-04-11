import { type ReactNode } from "react";
import type { AppTab } from "./app-types";
import { BottomNav } from "./BottomNav";

type AppShellProps = {
  children: ReactNode;
  tab: AppTab;
  pendingCount: number;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  toast: string | null;
  mode: "wife" | "husband";
  showAddButton?: boolean;
  immersive?: boolean;
};

export function AppShell({
  children,
  tab,
  pendingCount,
  onTabChange,
  onOpenAdd,
  toast,
  mode,
  showAddButton = true,
  immersive = false,
}: AppShellProps) {
  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div
        style={
          immersive
            ? { minHeight: "100dvh" }
            : { maxWidth: 480, margin: "0 auto", padding: "calc(var(--safe-top) + 20px) 20px calc(72px + env(safe-area-inset-bottom, 0px))" }
        }
      >
        {children}
      </div>

      {!immersive && <BottomNav tab={tab} pendingCount={pendingCount} onTabChange={onTabChange} />}

      {showAddButton && (
        <button
          onClick={onOpenAdd}
          aria-label="Open add expense"
          style={{
            position: "fixed",
            right: "max(18px, calc(50% - 222px))",
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
            zIndex: 60,
            width: 58,
            height: 58,
            borderRadius: "50%",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            background: mode === "wife" ? "color-mix(in srgb, var(--accent) 82%, white)" : "var(--accent)",
            color: "var(--accent-ink)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {toast && (
        <div
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
