import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AppTab, BudgetScope } from "./app-types";
import { BottomNav } from "./BottomNav";
import { PlusIcon, SearchIcon, SettingsIcon, ShuffleIcon } from "./ui/icons";
import { GlobalBudgetScopePicker } from "./ui/ScopeChipBar";
import { SettingsSheet } from "./SettingsSheet";
import { useAppHaptics } from "./ui/useAppHaptics";
import { ProgressiveBlur, useScrollEdges } from "./ui/ProgressiveBlur";

export function AppShell({
  tab,
  onTabChange,
  onOpenAdd,
  onOpenManage,
  budgetScope,
  onBudgetScopeChange,
  personalScope,
  onBudgetSearch,
  onReflectSearch,
  onBudgetRebalance,
  theme = "light",
  onSelectTheme,
  toast,
  showAddButton = true,
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenAdd: () => void;
  onOpenManage?: () => void;
  budgetScope: BudgetScope;
  onBudgetScopeChange: (scope: BudgetScope) => void;
  personalScope: Exclude<BudgetScope, "joint">;
  onBudgetSearch?: () => void;
  onReflectSearch?: () => void;
  onBudgetRebalance?: () => void;
  theme?: "system" | "light" | "dark";
  onSelectTheme?: (theme: "system" | "light" | "dark") => void;
  toast?: string | null;
  showAddButton?: boolean;
  children?: ReactNode;
}) {
  const { haptic } = useAppHaptics();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const { below: contentBelow } = useScrollEdges(contentEl);
  // Mobile scrolls .app-content; desktop (≥1100px) scrolls the page — watch both.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const measure = () => setScrolled((contentRef.current?.scrollTop ?? 0) > 1 || window.scrollY > 1);
    const content = contentRef.current;
    content?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      content?.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const useKeyboardModality = (event: KeyboardEvent) => {
      if (event.key === "Tab") root.dataset.inputModality = "keyboard";
    };
    const usePointerModality = () => {
      root.dataset.inputModality = "pointer";
    };
    window.addEventListener("keydown", useKeyboardModality, true);
    window.addEventListener("pointerdown", usePointerModality, true);
    return () => {
      window.removeEventListener("keydown", useKeyboardModality, true);
      window.removeEventListener("pointerdown", usePointerModality, true);
      delete root.dataset.inputModality;
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      content.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);

  return (
    <div className="app-shell-root" style={{ height: "100dvh", position: "relative" }}>
      <div
        ref={(node) => { contentRef.current = node; setContentEl(node); }}
        id="app-root-shell"
        className="app-content"
        style={{ height: "100%", overflowY: "auto", overflowAnchor: "none", position: "relative" }}
      >
        <header className="app-header" style={headerStyle}>
          {/* Content scrolling up melts into the header instead of cutting off at its edge. */}
          <ProgressiveBlur position="top" height={32} maxBlur={6} tint="var(--bg)" visible={scrolled} style={{ top: "100%", zIndex: -1 }} />
          <GlobalBudgetScopePicker value={budgetScope} onChange={onBudgetScopeChange} personalScope={personalScope} />
          <div className="app-header-actions">
            {tab === "budget" ? (
              <>
                <button className="app-top-action" type="button" onClick={onBudgetSearch} aria-label="Search categories" style={menuButtonStyle}>
                  <SearchIcon size={18} />
                </button>
                <button className="app-top-action" type="button" onClick={onBudgetRebalance} aria-label="Rebalance budget" style={menuButtonStyle}>
                  <ShuffleIcon size={18} />
                </button>
              </>
            ) : tab === "history" ? (
              <>
                <button className="app-top-action" type="button" onClick={onReflectSearch} aria-label="Search activity" style={menuButtonStyle}>
                  <SearchIcon size={18} />
                </button>
                {onSelectTheme && (
                  <button className="app-top-action" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" style={menuButtonStyle}>
                    <SettingsIcon size={18} />
                  </button>
                )}
              </>
            ) : onSelectTheme && (
              <button className="app-top-action" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" style={menuButtonStyle}>
                <SettingsIcon size={18} />
              </button>
            )}
          </div>
        </header>
        {children}
      </div>

      {/* Content fades out behind the floating nav instead of running into the screen edge. */}
      <ProgressiveBlur
        className="app-nav-blur"
        position="bottom"
        height="calc(96px + env(safe-area-inset-bottom, 0px))"
        fade={72}
        maxBlur={10}
        tint="color-mix(in srgb, var(--bg) 88%, transparent)"
        visible={contentBelow}
        style={{ zIndex: 55 }}
      />

      <div className="app-nav-wrap">
        <BottomNav tab={tab} onTabChange={onTabChange} />

        {showAddButton && (
          <button
            onClick={() => {
              haptic("light");
              onOpenAdd();
            }}
            className="fab-add app-nav-add"
            aria-label="Add transaction"
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              border: "1px solid var(--text)",
              background: "var(--text)",
              color: "var(--bg)",
              boxShadow: "var(--elevation-float)",
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

      {onSelectTheme && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onSelectTheme={onSelectTheme}
          onOpenAccounts={onOpenManage ? () => {
            setSettingsOpen(false);
            onOpenManage();
          } : undefined}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="app-toast"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
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
            boxShadow: "var(--elevation-float)",
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

const menuButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: "var(--surface)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: "none",
};

// Three columns so the mode picker sits at the true centre; actions hug the right edge.
const headerStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  marginBottom: 0,
};
