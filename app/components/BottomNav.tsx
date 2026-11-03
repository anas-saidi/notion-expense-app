"use client";
import type { CSSProperties, ReactNode } from "react";
import type { AppTab } from "./app-types";
import { HomeIcon, SlidersIcon, ChartPieIcon, WalletIcon } from "./ui/icons";
import { LiquidSurface } from "./ui/LiquidGlass";
import { useAppHaptics } from "./ui/useAppHaptics";

type BottomNavProps = {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  desktopPrimaryAction?: ReactNode;
  desktopActions?: ReactNode;
};

export function BottomNav({ tab, onTabChange, desktopPrimaryAction, desktopActions }: BottomNavProps) {
  const { haptic } = useAppHaptics();
  const items: { key: AppTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "budget", label: "Budget" },
    { key: "history", label: "Reflect" },
  ];

  return (
    <nav aria-label="App navigation" className="app-nav">
      <LiquidSurface className="app-nav-material" aria-hidden="true" />
      <span className="desktop-nav-brand" role="img" aria-label="Couple Finance" title="Couple Finance"><WalletIcon size={24} /></span>
      {desktopPrimaryAction && <div className="desktop-nav-primary" role="group" aria-label="Add transaction">{desktopPrimaryAction}</div>}
      <div className="app-nav-inner" role="tablist" aria-label="Main screens"
        style={{ "--nav-index": items.findIndex(item => item.key === tab) } as CSSProperties}
        onKeyDown={event => {
          const current = items.findIndex(item => item.key === tab);
          const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (current + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          if (tab !== items[next].key) haptic("selection");
          onTabChange(items[next].key);
          event.currentTarget.querySelector<HTMLButtonElement>(`#tab-${items[next].key}`)?.focus();
        }}>
        <LiquidSurface className="app-nav-selection" aria-hidden="true" />
        {items.map((item) => {
          const activeColor = "var(--accent-foreground)";

          return (
            <button
              key={item.key}
              id={`tab-${item.key}`}
              role="tab"
              aria-selected={tab === item.key}
              tabIndex={tab === item.key ? 0 : -1}
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
      <div className="desktop-nav-actions" role="group" aria-label="Actions">{desktopActions}</div>
    </nav>
  );
}
