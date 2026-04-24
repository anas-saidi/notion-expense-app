import type { AppTab } from "./app-types";
import { HomeIcon, ClockIcon, ListIcon } from "./ui/icons";

type BottomNavProps = {
  tab: AppTab;
  pendingCount: number;
  onTabChange: (tab: AppTab) => void;
};

export function BottomNav({ tab, pendingCount, onTabChange }: BottomNavProps) {
  const items: { key: AppTab; label: string }[] = [
    { key: "home", label: "Budget" },
    { key: "pending", label: "Upcoming" },
    { key: "history", label: "Activity" },
  ];

  return (
    <nav role="tablist" aria-label="App navigation" className="app-nav">
      <div className="app-nav-inner">
        {items.map((item) => {
          const activeColor = "var(--accent)";

          return (
            <button
              key={item.key}
              id={`tab-${item.key}`}
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`panel-${item.key}`}
              onClick={() => onTabChange(item.key)}
              className="app-nav-btn"
              style={{ color: tab === item.key ? activeColor : "var(--muted)" }}
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

              {item.key === "home" && <HomeIcon strokeWidth={tab === "home" ? 2.5 : 2} />}
              {item.key === "pending" && <ClockIcon strokeWidth={tab === "pending" ? 2.5 : 2} />}
              {item.key === "history" && <ListIcon strokeWidth={tab === "history" ? 2.5 : 2} />}

              <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
