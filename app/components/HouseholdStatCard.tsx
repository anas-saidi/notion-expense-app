"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Money } from "./Money";

export type Scope = "household" | "wife" | "husband";

type StatView = {
  spent: number;
  planned: number;
};

type DerivedStatView = StatView & {
  remaining: number;
  progress: number;
  status: "on-track" | "near-limit" | "over-budget";
};

type HouseholdStatCardProps = {
  views: Record<Scope, StatView>;
  scope: Scope;
  onScopeChange: (nextScope: Scope) => void;
  readyToAssignByScope: Record<Scope, number>;
  contributionDueByScope?: { wife: number; husband: number; total: number };
  householdSpentByPartner?: { wife: number; husband: number; other: number; total: number };
};

const SCOPE_ORDER: Scope[] = ["household", "wife", "husband"];

const SCOPE_LABELS: Record<Scope, string> = {
  household: "Household",
  wife: "Wife",
  husband: "Husband",
};

const HINT_STORAGE_KEY = "household-stat-card-hint-hidden";

export function HouseholdStatCard({ views, scope, onScopeChange, readyToAssignByScope, contributionDueByScope, householdSpentByPartner }: HouseholdStatCardProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [activeTick, setActiveTick] = useState<"wife" | "husband" | null>(null);
  const [hoverTick, setHoverTick] = useState<"wife" | "husband" | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowHint(window.localStorage.getItem(HINT_STORAGE_KEY) !== "true");
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    setTransitionKey((value) => value + 1);
    setActiveTick(null);
  }, [scope]);

  const activeView = useMemo<DerivedStatView>(() => {
    const planned = views[scope].planned;
    const spent = views[scope].spent;
    const remaining = readyToAssignByScope[scope] ?? 0;
    const progress = planned > 0 ? spent / planned : 0;

    let status: DerivedStatView["status"] = "on-track";
    if (progress > 1) status = "over-budget";
    else if (progress >= 0.85) status = "near-limit";

    return { planned, spent, remaining, progress, status };
  }, [readyToAssignByScope, scope, views]);

  const hideHint = () => {
    setShowHint(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HINT_STORAGE_KEY, "true");
    }
  };

  const cycleScope = () => {
    const currentIndex = SCOPE_ORDER.indexOf(scope);
    const nextScope = SCOPE_ORDER[(currentIndex + 1) % SCOPE_ORDER.length];
    onScopeChange(nextScope);
    if (showHint) hideHint();
  };

  const animatedRemaining = useAnimatedNumber(activeView.remaining);
  const barTone = resolveStatusTone(activeView.status);
  const clampedProgress = Math.max(0, Math.min(activeView.progress, 1));
  const statusLabel = resolveStatusLabel(activeView.status);
  
  const transitionName = prefersReducedMotion ? "statCardFade" : "statCardRise";
  const remainingAbs = Math.abs(animatedRemaining);
  const remainingIsNegative = animatedRemaining < 0;
  const householdPlanned = views.household.planned;
  const showContributionTicks = scope === "household" && !!contributionDueByScope?.total && householdPlanned > 0;
  const wifeTickPct = showContributionTicks
    ? Math.min(100, (contributionDueByScope!.wife / householdPlanned) * 100)
    : 0;
  const husbandTickPct = showContributionTicks
    ? Math.min(100, (contributionDueByScope!.husband / householdPlanned) * 100)
    : 0;
  const spentForBar = Math.min(activeView.spent, activeView.planned);
  const splitSourceTotal = householdSpentByPartner?.total ?? 0;
  const hasSplit = scope === "household" && splitSourceTotal > 0 && activeView.planned > 0;
  const splitScale = hasSplit && spentForBar > 0
    ? Math.min(1, spentForBar / splitSourceTotal)
    : 0;
  const wifeSpent = hasSplit ? (householdSpentByPartner!.wife * splitScale) : 0;
  const husbandSpent = hasSplit ? (householdSpentByPartner!.husband * splitScale) : 0;
  const otherSpent = hasSplit ? (householdSpentByPartner!.other * splitScale) : 0;
  const splitSum = wifeSpent + husbandSpent + otherSpent;
  const unassignedSpent = hasSplit ? Math.max(0, spentForBar - splitSum) : 0;
  const plannedDenominator = activeView.planned || 1;
  const wifeSpentPct = hasSplit ? (wifeSpent / plannedDenominator) * 100 : 0;
  const husbandSpentPct = hasSplit ? (husbandSpent / plannedDenominator) * 100 : 0;
  const otherSpentPct = hasSplit ? (otherSpent / plannedDenominator) * 100 : 0;
  const unassignedSpentPct = hasSplit ? (unassignedSpent / plannedDenominator) * 100 : 0;
  const segmentParts = hasSplit
    ? [
        {
          key: "wife",
          left: 0,
          width: wifeSpentPct,
          color: "color-mix(in srgb, #e86c95 60%, #fff5f8)",
        },
        {
          key: "husband",
          left: wifeSpentPct,
          width: husbandSpentPct,
          color: "color-mix(in srgb, #6aa6e6 60%, #f3f7ff)",
        },
        {
          key: "other",
          left: wifeSpentPct + husbandSpentPct,
          width: otherSpentPct,
          color: "color-mix(in srgb, var(--surface2) 88%, white)",
        },
        {
          key: "unassigned",
          left: wifeSpentPct + husbandSpentPct + otherSpentPct,
          width: unassignedSpentPct,
          color: barTone,
        },
      ].filter((segment) => segment.width > 0)
    : [];
  const firstSegmentKey = segmentParts[0]?.key ?? null;
  const lastSegmentKey = segmentParts[segmentParts.length - 1]?.key ?? null;
  const segmentRadius = (key: string) => {
    if (key === firstSegmentKey && key === lastSegmentKey) return "8px";
    if (key === firstSegmentKey) return "8px 0 0 8px";
    if (key === lastSegmentKey) return "0 8px 8px 0";
    return "0";
  };
  const showPartnerChips = scope === "household" && !!householdSpentByPartner && householdSpentByPartner.total > 0;
  const wifeContribution = contributionDueByScope?.wife ?? 0;
  const husbandContribution = contributionDueByScope?.husband ?? 0;

  return (
    <section
      aria-label="Monthly household budget summary"
      style={{
        display: "grid",
        gap: 16,
        padding: "18px 18px 17px",
        borderRadius: 22,
        border: "none",
        background: "color-mix(in srgb, var(--surface) 96%, white)",
        boxShadow: "0 18px 32px -26px color-mix(in srgb, var(--accent) 22%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={eyebrowStyle}>This month</span>
      </div>

      <button
        type="button"
        onClick={cycleScope}
        aria-label={`Tap to switch summary scope. Currently showing ${SCOPE_LABELS[scope]}.`}
        style={tapAreaStyle}
      >
        <div key={`scope-${transitionKey}`} style={{ ...contentStackStyle, animation: `${transitionName} 200ms ease-out both` }}>
          <span style={scopeLabelStyle}>{SCOPE_LABELS[scope]}</span>
          <div style={headlineRowStyle}>
            <div style={numberWrapStyle}>
              <div style={{ ...numberStyle, color: remainingIsNegative ? "var(--danger)" : numberStyle.color }}>
                <Money
                  value={remainingAbs}
                  currencyStyle={{ fontSize: "0.3em", letterSpacing: 0.7, opacity: 0.48 }}
                />
                <span style={numberSuffixStyle}>remaining</span>
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden="true" style={dotsRowStyle}>
          {SCOPE_ORDER.map((item) => (
            <span
              key={item}
              style={{
                ...dotStyle,
                opacity: item === scope ? 1 : 0.28,
                transform: item === scope ? "scale(1)" : "scale(0.8)",
                background: item === scope ? "var(--text)" : "color-mix(in srgb, var(--text2) 60%, white)",
                boxShadow: item === scope
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--ink-strong) 10%, white), 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent)"
                  : dotStyle.boxShadow,
                animation: "none",
              }}
            />
          ))}
        </div>

        {hasHydrated && showHint ? <span style={hintStyle}>Tap to switch</span> : null}
      </button>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={progressWrapStyle}>
          <div aria-hidden="true" style={progressTrackStyle}>
            {hasSplit ? (
              <>
                {segmentParts.map((segment) => (
                  <div
                    key={segment.key}
                    style={{
                      ...progressSegmentStyle,
                      left: `${segment.left}%`,
                      width: `${segment.width}%`,
                      background: segment.color,
                      borderRadius: segmentRadius(segment.key),
                    }}
                  />
                ))}
              </>
            ) : (
              <div style={{ ...progressFillStyle, width: `${clampedProgress * 100}%`, background: barTone }} />
            )}
          </div>

          {showContributionTicks && contributionDueByScope!.wife > 0 && (
            <div
              style={{ ...contributionTickWrapStyle, left: `${wifeTickPct}%` }}
              role="button"
              tabIndex={0}
              aria-pressed={activeTick === "wife"}
              aria-label="Show wife contribution"
              onMouseEnter={() => setHoverTick("wife")}
              onMouseLeave={() => setHoverTick(null)}
              onFocus={() => setHoverTick("wife")}
              onBlur={() => setHoverTick(null)}
              onClick={() => setActiveTick((prev) => (prev === "wife" ? null : "wife"))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveTick((prev) => (prev === "wife" ? null : "wife"));
                }
              }}
            >
              <div style={{ ...contributionTickLineStyle, background: "#b34b6a" }} />
              <div
                style={{
                  ...contributionTickDotStyle,
                  background: "#e86c95",
                  boxShadow:
                    activeTick === "wife"
                      ? "0 0 0 4px color-mix(in srgb, #e86c95 18%, transparent)"
                      : hoverTick === "wife"
                        ? "0 0 0 3px color-mix(in srgb, #e86c95 14%, transparent)"
                        : contributionTickDotStyle.boxShadow,
                }}
              />
              {showPartnerChips && activeTick === "wife" && (
                <div style={tickChipStyle}>
                  W · <Money value={householdSpentByPartner!.wife} />/<Money value={wifeContribution} />
                </div>
              )}
            </div>
          )}
          {showContributionTicks && contributionDueByScope!.husband > 0 && (
            <div
              style={{ ...contributionTickWrapStyle, left: `${husbandTickPct}%` }}
              role="button"
              tabIndex={0}
              aria-pressed={activeTick === "husband"}
              aria-label="Show husband contribution"
              onMouseEnter={() => setHoverTick("husband")}
              onMouseLeave={() => setHoverTick(null)}
              onFocus={() => setHoverTick("husband")}
              onBlur={() => setHoverTick(null)}
              onClick={() => setActiveTick((prev) => (prev === "husband" ? null : "husband"))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveTick((prev) => (prev === "husband" ? null : "husband"));
                }
              }}
            >
              <div style={{ ...contributionTickLineStyle, background: "#2a6fb4" }} />
              <div
                style={{
                  ...contributionTickDotStyle,
                  background: "#6aa6e6",
                  boxShadow:
                    activeTick === "husband"
                      ? "0 0 0 4px color-mix(in srgb, #6aa6e6 18%, transparent)"
                      : hoverTick === "husband"
                        ? "0 0 0 3px color-mix(in srgb, #6aa6e6 14%, transparent)"
                        : contributionTickDotStyle.boxShadow,
                }}
              />
              {showPartnerChips && activeTick === "husband" && (
                <div style={tickChipStyle}>
                  H · <Money value={householdSpentByPartner!.husband} />/<Money value={husbandContribution} />
                </div>
              )}
            </div>
          )}
        </div>
        <div style={barMetaRowStyle}>
          <span style={barMetaStyle}>Spent <span style={barMetaEmphasisStyle}><Money value={activeView.spent} /></span></span>
          <span style={barMetaStyle}>Planned <span style={barMetaEmphasisStyle}><Money value={activeView.planned} /></span></span>
        </div>
        <div style={footerRowStyle}>
          <span style={footerStatusStyle(activeView.status)}>{statusLabel}</span>
        </div>
      </div>
    </section>
  );
}

function resolveStatusLabel(status: DerivedStatView["status"]) {
  if (status === "over-budget") return "Over plan";
  if (status === "near-limit") return "Close to limit";
  return "On track";
}

function resolveStatusTone(status: DerivedStatView["status"]) {
  if (status === "over-budget") return "color-mix(in srgb, var(--danger) 82%, #f2a1a0)";
  if (status === "near-limit") return "color-mix(in srgb, #c7881a 78%, #f3ddb0)";
  return "color-mix(in srgb, #2f8f8a 78%, #bfe9de)";
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);

    update();

    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
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
    const duration = 380;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
  fontSize: 12,
  fontWeight: 600,
  color: "color-mix(in srgb, var(--text2) 80%, #7a7268)",
};

const tapAreaStyle: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "transparent",
  display: "grid",
  gap: 10,
  justifyItems: "start",
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
};

const contentStackStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 108,
  alignContent: "start",
};

const scopeLabelStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.2,
  fontWeight: 600,
  color: "color-mix(in srgb, var(--text) 88%, #473f37)",
};

const valueContextStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.35,
  color: "color-mix(in srgb, var(--muted) 86%, #93897d)",
};

const numberSuffixStyle: CSSProperties = {
  marginLeft: 8,
  fontSize: "0.28em",
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--text2) 70%, #8a8278)",
};

const numberStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.45rem, 9vw, 3.15rem)",
  lineHeight: 0.9,
  letterSpacing: -1.35,
  fontWeight: 700,
  color: "color-mix(in srgb, var(--text) 95%, #231b17)",
};

const numberWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
};

const headlineRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "end",
  gap: 12,
};

const supportingCopyStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "baseline",
  fontSize: 14,
  lineHeight: 1.45,
  color: "color-mix(in srgb, var(--text2) 84%, #7f766d)",
};

const remainingPulseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  animation: "remainingPulse 220ms cubic-bezier(0.22, 1, 0.36, 1)",
};

const dotsRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  transition: "transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ink-strong) 10%, white)",
};

const hintStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  color: "color-mix(in srgb, var(--muted) 82%, #958b80)",
};

const footerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  flexWrap: "wrap",
};

const barMetaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const barMetaStyle: CSSProperties = {
  fontSize: 11,
  color: "color-mix(in srgb, var(--text2) 72%, #7a7167)",
  letterSpacing: 0.2,
};

const barMetaEmphasisStyle: CSSProperties = {
  color: "color-mix(in srgb, var(--text) 92%, #2e2520)",
  fontWeight: 600,
};

const progressWrapStyle: CSSProperties = {
  position: "relative",
  height: 28,
  marginBottom: 12,
  marginTop: 10,
};

const progressTrackStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 8,
  overflow: "hidden",
  background: "color-mix(in srgb, var(--surface2) 78%, white)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 30%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent)",
};

const progressFillStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  borderRadius: 0,
  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s",
};

const progressSegmentStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  height: "100%",
  borderRadius: 0,
  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1), left 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
};

const contributionTickWrapStyle: CSSProperties = {
  position: "absolute",
  top: -8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  pointerEvents: "auto",
  transform: "translateX(-50%)",
  width: 0,
  minWidth: 36,
  minHeight: 36,
  cursor: "pointer",
  transition: "left 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s",
};

const contributionTickLineStyle: CSSProperties = {
  width: 2,
  height: 8,
  borderRadius: 1,
};

const contributionTickDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  border: "2px solid #fff",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--surface) 55%, transparent)",
  position: "relative",
  top: -4,
};


const tickChipStyle: CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginBottom: 6,
  fontSize: 10,
  fontWeight: 500,
  lineHeight: 1.1,
  color: "color-mix(in srgb, var(--text2) 62%, #6f665c)",
  background: "color-mix(in srgb, var(--surface2) 86%, white)",
  padding: "2px 5px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const footerStatusStyle = (status: DerivedStatView["status"]): CSSProperties => ({
  fontSize: 13,
  fontWeight: 600,
  color:
    status === "over-budget"
      ? "var(--danger)"
      : status === "near-limit"
        ? "color-mix(in srgb, #9a6a00 82%, var(--text))"
        : "var(--success)",
});

