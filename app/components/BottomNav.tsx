import type { ReactNode } from "react";
import type { AppTab } from "./app-types";
import { HomeIcon, SlidersIcon, ChartPieIcon, WalletIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";

type BottomNavProps = {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  desktopActions?: ReactNode;
  desktopSearch?: ReactNode;
};

export function BottomNav({ tab, onTabChange, desktopActions, desktopSearch }: BottomNavProps) {
  const { haptic } = useAppHaptics();
  const items: { key: AppTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "budget", label: "Budget" },
    { key: "history", label: "Reflect" },
  ];

  return (
    <nav aria-label="App navigation" className="app-nav">
      <span className="desktop-nav-brand" role="img" aria-label="Couple Finance" title="Couple Finance"><WalletIcon size={24} /></span>
      <div className="desktop-nav-search">{desktopSearch}</div>
      <div className="app-nav-inner" role="tablist" aria-label="Main screens">
        {items.map((item) => {
          const activeColor = "var(--accent-foreground)";

          return (
            <button
              key={item.key}
              id={`tab-${item.key}`}
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`panel-${item.key}`}
              aria-label={item.label}
              onClick={() => {
                if (tab !== item.key) haptic("selection");
                onTabChange(item.key);
              }}
              className="app-nav-btn"
              style={{ color: tab === item.key ? activeColor : "var(--muted)" }}
            >
              {item.key === "home" && <HomeIcon size={20} strokeWidth={tab === "home" ? 2.5 : 2} />}
              {item.key === "budget" && <SlidersIcon size={20} strokeWidth={tab === "budget" ? 2.5 : 2} />}
              {item.key === "history" && <ChartPieIcon size={20} strokeWidth={tab === "history" ? 2.5 : 2} />}

              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="desktop-nav-actions" aria-label="Tools">{desktopActions}</div>
    </nav>
  );
}
