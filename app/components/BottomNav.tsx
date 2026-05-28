import type { AppTab } from "./app-types";
import { HomeIcon, ListIcon, SlidersIcon } from "./ui/icons";

type BottomNavProps = {
  tab: AppTab;
  pendingCount?: number;
  onTabChange: (tab: AppTab) => void;
};

export function BottomNav({ tab, onTabChange }: BottomNavProps) {
  const items: { key: AppTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "budget", label: "Budget" },
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
              {item.key === "home" && <HomeIcon size={20} strokeWidth={tab === "home" ? 2.5 : 2} />}
              {item.key === "budget" && <SlidersIcon size={20} strokeWidth={tab === "budget" ? 2.5 : 2} />}
              {item.key === "history" && <ListIcon size={20} strokeWidth={tab === "history" ? 2.5 : 2} />}

              <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
