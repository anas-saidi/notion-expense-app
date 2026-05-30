import { type ReactNode } from "react";
import type { AppTab } from "./app-types";
import { BottomNav } from "./BottomNav";
import { LandmarkIcon, PlusIcon } from "./ui/icons";

export function AppShell({
  tab,
  pendingCount = 0,
  onTabChange,
  onOpenAdd,
  onOpenManage,
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
  toast?: string | null;
  showAddButton?: boolean;
  immersive?: boolean;
  hideHeader?: boolean;
  children?: ReactNode;
}) {
  return (
    <div style={{ height: "100dvh", overflow: "hidden", position: "relative", zIndex: 1 }}>
      <div
        id={!immersive ? "app-root-shell" : undefined}
        className={immersive ? undefined : "app-content"}
        style={immersive ? { height: "100%" } : { height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" as any, position: "relative" }}
      >
        {!immersive && !hideHeader && onOpenManage && (
          <header style={headerStyle}>
            <div aria-label="Couple greeting">
              <p style={greetingEyebrowStyle}>{getGreeting()}</p>
              <h1 style={greetingTitleStyle}>Anas &amp; Salma</h1>
            </div>
            <button type="button" onClick={onOpenManage} aria-label="Accounts" style={menuButtonStyle}>
              <LandmarkIcon size={18} />
            </button>
          </header>
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

const menuButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
  paddingLeft: 4,
  paddingRight: 4,
};

const greetingEyebrowStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  margin: "0 0 3px",
};

const greetingTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 800,
  color: "var(--text)",
  margin: 0,
};
