"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAppHaptics } from "./useAppHaptics";

type Theme = "system" | "light" | "dark";

// Sun/moon animation adapted from Skiper UI's ThemeToggleButton2:
// https://skiper-ui.com/v1/skiper4 (itself inspired by Alfie Jones' toggles.dev).
export function ThemeToggle({ theme, onSelectTheme }: { theme: Theme; onSelectTheme: (theme: Theme) => void }) {
  const [systemDark, setSystemDark] = useState(false);
  const reduceMotion = useReducedMotion();
  const { haptic } = useAppHaptics();
  const clipId = `theme-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemDark);
  const transition = { duration: reduceMotion ? 0 : 0.35, ease: "easeInOut" as const };

  return <div role="group" aria-label="Appearance" style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <button type="button" className="appearance-system-button" aria-label="Use system appearance" aria-pressed={theme === "system"}
      onClick={() => { if (theme !== "system") { haptic("selection"); onSelectTheme("system"); } }}>
      System
    </button>
    <button type="button" className="appearance-theme-button" aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={() => { haptic("selection"); onSelectTheme(isDark ? "light" : "dark"); }}>
      <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" strokeLinecap="round" aria-hidden="true">
        <defs><clipPath id={clipId}>
          <motion.path initial={false} animate={{ y: isDark ? 10 : 0, x: isDark ? -12 : 0 }} transition={transition} d="M0-5h30a1 1 0 0 0 9 13v24H0Z" />
        </clipPath></defs>
        <g clipPath={`url(#${clipId})`}>
          <motion.circle initial={false} animate={{ r: isDark ? 10 : 8 }} transition={transition} cx="16" cy="16" />
          <motion.g initial={false} animate={{ rotate: isDark ? -100 : 0, scale: isDark ? 0.5 : 1, opacity: isDark ? 0 : 1 }}
            transition={transition} stroke="currentColor" strokeWidth="1.5" style={{ transformOrigin: "16px 16px" }}>
            <path d="M16 5.5v-4M16 30.5v-4M1.5 16h4M26.5 16h4m-3.1-7.4 2.8-2.8M5.7 26.3l2.9-2.9M5.8 5.8l2.8 2.8m14.8 14.8 2.9 2.9" />
          </motion.g>
        </g>
      </svg>
    </button>
  </div>;
}
