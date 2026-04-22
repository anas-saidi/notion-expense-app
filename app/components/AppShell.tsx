import { type ReactNode } from "react";
import type { AppTab } from "./app-types";
import { BottomNav } from "./BottomNav";
import { PlusIcon } from "./ui/icons";

type AppShellProps = {
  children: ReactNode;
  tab: AppTab;
  pendingCount: number;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  onSwitchIdentity: () => void;
  toast: string | null;
  mode: "wife" | "husband";
  showAddButton?: boolean;
  immersive?: boolean;
};

const IDENTITY_NAMES: Record<"wife" | "husband", string> = { wife: "Salma", husband: "Anas" };
const IDENTITY_COLOR: Record<"wife" | "husband", string> = {
  wife: "var(--partner-wife)",
  husband: "var(--partner-husband)",
};

export function AppShell({
  children,
  tab,
  pendingCount,
  onTabChange,
  onOpenAdd,
  onSwitchIdentity,
  toast,
  mode,
  showAddButton = true,
  immersive = false,
}: AppShellProps) {
  return (
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1 }}>
      <div
        className={immersive ? undefined : "app-content"}
        style={immersive ? { minHeight: "100dvh" } : { position: "relative" }}
      >
        {!immersive && (
          <button
            onClick={onSwitchIdentity}
            className="identity-chip"
            aria-label={`Signed in as ${IDENTITY_NAMES[mode]} — tap to switch`}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              padding: "0 12px",
              borderRadius: 999,
              border: "1px solid var(--border2)",
              background: "var(--surface)",
              color: "var(--text2)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: 0.2,
              zIndex: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: IDENTITY_COLOR[mode],
                flexShrink: 0,
              }}
            />
            {IDENTITY_NAMES[mode]}
          </button>
        )}
        {children}
      </div>

      {!immersive && <BottomNav tab={tab} pendingCount={pendingCount} onTabChange={onTabChange} />}

      {showAddButton && (
        <button
          onClick={onOpenAdd}
          className="fab-add"
          aria-label="Add expense"
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
          <PlusIcon size={22} strokeWidth={2.5} />
        </button>
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
