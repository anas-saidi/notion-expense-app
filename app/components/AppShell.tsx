import { type ReactNode } from "react";
import type { AppTab } from "./app-types";
import { BottomNav } from "./BottomNav";
import { PlusIcon } from "./ui/icons";
import { TAB_COPY } from "./tab-copy";

// Stacked couple avatars shown in the app header
function CoupleBadge() {
  const people = [
    { label: "S", color: "#e57373" },
    { label: "A", color: "#4f8cff" },
  ];
  const avatarBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
    border: "2px solid var(--bg, #fbfdf7)",
    flexShrink: 0,
  } as const;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span style={{ ...avatarBase, background: people[0].color, zIndex: 2 }}>
        {people[0].label}
      </span>
      <span style={{ ...avatarBase, background: people[1].color, zIndex: 1, marginLeft: -8 }}>
        {people[1].label}
      </span>
    </span>
  );
}
export function AppShell({
  tab,
  pendingCount = 0,
  onTabChange,
  onOpenAdd,
  toast,
  showAddButton = true,
  immersive = false,
  children,
}: {
  tab: AppTab;
  pendingCount?: number;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  toast?: string | null;
  showAddButton?: boolean;
  immersive?: boolean;
  children?: ReactNode;
}) {
  const shellCopy = TAB_COPY[tab];
  const isHomeTab = tab === "home";

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
            <div style={{ minWidth: 0, display: "grid", gap: 5, paddingTop: 2 }}>
              <span
                style={{
                  fontSize: isHomeTab ? 10 : 11,
                  fontWeight: isHomeTab ? 600 : 700,
                  letterSpacing: isHomeTab ? 0.32 : 0.42,
                  textTransform: "uppercase",
                  color: isHomeTab ? "color-mix(in srgb, var(--muted) 86%, transparent)" : "var(--muted)",
                }}
              >
                {shellCopy.eyebrow}
              </span>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: isHomeTab ? "clamp(1.32rem, 5.3vw, 1.72rem)" : "clamp(1.5rem, 6vw, 2rem)",
                  lineHeight: isHomeTab ? 0.98 : 0.94,
                  letterSpacing: isHomeTab ? -0.25 : -0.5,
                  color: "var(--text)",
                  fontWeight: isHomeTab ? 650 : undefined,
                }}
              >
                {shellCopy.title}
              </h1>
            </div>
            <CoupleBadge />
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
