"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MonthlyPlanningSnapshot } from "./app-types";
import { Money } from "./Money";

type MonthlyPlanningHeaderProps = {
  monthLabel: string;
  snapshot: MonthlyPlanningSnapshot;
  isUsingFallbackData: boolean;
  compact?: boolean;
};

export function MonthlyPlanningHeader({
  monthLabel,
  snapshot,
  isUsingFallbackData,
  compact = false,
}: MonthlyPlanningHeaderProps) {
  const animatedAvailablePool = useAnimatedNumber(snapshot.availablePool);
  const animatedLeftToAssign = useAnimatedNumber(snapshot.leftToAssign);

  return (
    <section
      style={{
        position: "sticky",
        top: compact ? "calc(var(--safe-top) + 8px)" : "calc(var(--safe-top) + 12px)",
        zIndex: 20,
        marginBottom: compact ? 14 : 18,
        animation: "fadeUp 0.45s ease both",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 22,
          background: "color-mix(in srgb, var(--surface) 92%, white)",
          padding: compact ? "12px 12px 10px" : "14px 14px 12px",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: compact ? 18 : 20 }}>
          <div style={numberBlockStyle}>
            <div style={eyebrowStyle}>Current balance</div>
            <div style={numberStyle}>
              <Money value={animatedAvailablePool} />
            </div>
            <p style={metaCopyStyle}>{monthLabel}</p>
          </div>

          <div style={numberBlockStyle}>
            <div style={eyebrowStyle}>Current left to assign</div>
            <div
              style={{
                ...numberStyle,
                color:
                  snapshot.leftToAssign < 0
                    ? "var(--danger)"
                    : snapshot.leftToAssign === 0
                      ? "color-mix(in srgb, var(--warning) 82%, black)"
                      : "var(--text)",
              }}
            >
              <Money value={animatedLeftToAssign} />
            </div>
          </div>

          {isUsingFallbackData && (
            <div style={metaChipStyle}>
              Estimated
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function useAnimatedNumber(value: number) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const targetValue = value;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (prefersReducedMotion || startValue === targetValue) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    const delta = targetValue - startValue;
    const duration = 420;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(startValue + delta * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = targetValue;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [prefersReducedMotion, value]);

  return displayValue;
}

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.55,
  textTransform: "uppercase",
  color: "var(--text2)",
};

const numberStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: "clamp(2rem, 9vw, 3rem)",
  lineHeight: 1,
  letterSpacing: -0.9,
  fontWeight: 700,
};

const metaCopyStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 12,
  textAlign: "center",
};

const metaChipStyle: CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "var(--warning-dim)",
  color: "color-mix(in srgb, var(--warning) 88%, var(--text))",
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const numberBlockStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "center",
  textAlign: "center",
};
