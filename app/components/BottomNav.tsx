import { type CSSProperties } from "react";
import type { AppTab } from "./app-types";

type BottomNavProps = {
  tab: AppTab;
  pendingCount: number;
  onTabChange: (tab: AppTab) => void;
};

const navStyle: CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  background: "color-mix(in srgb, var(--bg) 82%, var(--surface))",
  borderTop: "1px solid color-mix(in srgb, var(--border2) 56%, transparent)",
  boxShadow: "0 -4px 12px color-mix(in srgb, var(--ink-strong) 8%, transparent)",
  paddingBottom: "env(safe-area-inset-bottom)",
};

export function BottomNav({ tab, pendingCount, onTabChange }: BottomNavProps) {
  const items: { key: AppTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "pending", label: "Pending" },
    { key: "history", label: "History" },
  ];

  return (
    <nav role="tablist" aria-label="App navigation" style={navStyle}>
      <div style={{ display: "flex", maxWidth: 480, margin: "0 auto" }}>
        {items.map((item) => {
          const activeColor =
            item.key === "home"
              ? "var(--accent)"
              : item.key === "pending"
                  ? "var(--warning)"
                  : "var(--info)";

          return (
            <button
              key={item.key}
              id={`tab-${item.key}`}
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`panel-${item.key}`}
              onClick={() => onTabChange(item.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "10px 0 11px",
                background: "none",
                border: "none",
                borderTop: "2px solid transparent",
                cursor: "pointer",
                color: tab === item.key ? activeColor : "var(--muted)",
                transition: "color 0.2s, border-color 0.2s",
                position: "relative",
              }}
            >
              {item.key === "pending" && pendingCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: "calc(50% - 20px)",
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "var(--warning)",
                    color: "var(--ink-strong)",
                    fontSize: 9,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                  }}
                >
                  {pendingCount}
                </span>
              )}

              {item.key === "home" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "home" ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                </svg>
              )}
              {item.key === "pending" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "pending" ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
              {item.key === "history" && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "history" ? "2.5" : "2"} strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              )}

              <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
