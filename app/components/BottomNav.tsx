"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { AppTab } from "./app-types";
import { HomeIcon, SlidersIcon, ChartPieIcon, WalletIcon } from "./ui/icons";
import { LiquidButton, LiquidSurface, LiquidTabBar } from "./ui/LiquidGlass";
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

  const phoneNav = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Glisse exposes container props but not per-item IDs. Link its focusable
    // tabs to the same panels, using the visible tablist for panel labels.
    const media = window.matchMedia("(max-width: 899px)");
    const syncLabels = () => {
      phoneNav.current?.querySelectorAll<HTMLButtonElement>("button[role=tab]").forEach((button, index) => {
        const key = items[index]?.key;
        if (!key) return;
        button.id = `phone-tab-${key}`;
        button.setAttribute("aria-controls", `panel-${key}`);
      });
      for (const { key } of items) document.getElementById(`panel-${key}`)?.setAttribute("aria-labelledby", `${media.matches ? "phone-tab" : "tab"}-${key}`);
    };
    syncLabels();
    media.addEventListener("change", syncLabels);
    return () => media.removeEventListener("change", syncLabels);
  }, [tab]); // The tab items and their order are fixed.


  return (
    <nav aria-label="App navigation" className="app-nav">
      <div ref={phoneNav} className="phone-nav-glass">
        <LiquidTabBar className="phone-nav-tabs" aria-label="Main screens"
          items={items.map(item => ({ value: item.key, label: item.label, icon: item.key === "home" ? <HomeIcon size={22} /> : item.key === "budget" ? <SlidersIcon size={22} /> : <ChartPieIcon size={22} /> }))}
          value={tab} onValueChange={value => {
            if (value !== "home" && value !== "budget" && value !== "history") return;
            if (tab !== value) haptic("selection");
            onTabChange(value);
          }} />
      </div>
      <span className="desktop-nav-brand" role="img" aria-label="Couple Finance" title="Couple Finance"><WalletIcon size={24} /></span>
      {desktopPrimaryAction && <div className="desktop-nav-primary" role="group" aria-label="Add transaction">{desktopPrimaryAction}</div>}
      <div className="app-nav-inner desktop-glass-nav" role="tablist" aria-label="Main screens"
        onKeyDown={event => {
          const current = items.findIndex(item => item.key === tab);
          const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (current + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          if (tab !== items[next].key) haptic("selection");
          onTabChange(items[next].key);
          event.currentTarget.querySelector<HTMLButtonElement>(`#tab-${items[next].key}`)?.focus();
        }}>
        <LiquidSurface className="desktop-nav-material" aria-hidden="true" />
        {items.map((item) => {
          const activeColor = "var(--accent-foreground)";

          return (
            <LiquidButton
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
            </LiquidButton>
          );
        })}
      </div>
      <div className="desktop-nav-actions" role="group" aria-label="Actions">{desktopActions}</div>
    </nav>
  );
}
