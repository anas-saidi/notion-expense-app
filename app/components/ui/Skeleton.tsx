import "./screen-hero.css";
import { SCREEN_HERO_MASCOT_SIZE } from "./hero-tokens";
import type { CSSProperties, ReactNode } from "react";

/** One visual treatment for pending content; decorative shapes stay out of the accessibility tree. */
export function Skeleton({ style }: { style?: CSSProperties }) {
  return <span aria-hidden="true" className="skeleton" style={{ display: "block", height: 14, width: "100%", ...style }} />;
}

export function SkeletonRegion({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return <div role="status" aria-label={label} aria-busy="true" style={style}>{children}</div>;
}

export function HeroSkeleton({ label = "Loading monthly details", size = SCREEN_HERO_MASCOT_SIZE }: { label?: string; size?: number }) {
  return <SkeletonRegion label={label} style={{ minHeight: size, display: "grid", placeItems: "center" }}>
    <Skeleton style={{ width: size * 0.72, height: size * 0.84, borderRadius: 40 }} />
  </SkeletonRegion>;
}

export function SkeletonRows({ label = "Loading activity", count = 3, iconSize = 24 }: { label?: string; count?: number; iconSize?: number }) {
  return <SkeletonRegion label={label}>
    {Array.from({ length: count }, (_, index) => <div key={index} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
      <Skeleton style={{ width: iconSize, height: iconSize, borderRadius: iconSize > 32 ? 18 : 6, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "grid", gap: 7, minWidth: 0 }}>
        <Skeleton style={{ width: `${index % 2 ? 48 : 60}%`, height: 13 }} />
        <Skeleton style={{ width: "32%", height: 10 }} />
      </div>
      <div style={{ display: "grid", gap: 7, justifyItems: "end" }}>
        <Skeleton style={{ width: 60, height: 13 }} />
        <Skeleton style={{ width: 36, height: 10 }} />
      </div>
    </div>)}
  </SkeletonRegion>;
}

/** Shared shimmer for an unknown primary amount; keep the metric row's height. */
export function AmountSkeleton() {
  return <Skeleton style={{ width: 180, maxWidth: "60vw", height: ".75em", borderRadius: 12 }} />;
}

/** Reserves the same mascot, metric, summary and toolbar regions as loaded screens. */
export function ScreenLoadingSkeleton({ label = "Loading screen", toolbar = true }: { label?: string; toolbar?: boolean }) {
  return <SkeletonRegion label={label} style={{ display: "grid", gap: 24 }}>
    <div className="screen-overview">
      <div className="screen-hero" style={{ "--hero-mascot-size": `${SCREEN_HERO_MASCOT_SIZE}px` } as CSSProperties}>
        <div className="screen-hero-mascot"><HeroSkeleton /></div>
        <div className="screen-hero-metric">
          <div className="screen-hero-label"><Skeleton style={{ width: 64, height: 20 }} /></div>
          <div className="screen-hero-value"><AmountSkeleton /></div>
        </div>
        <div className="screen-hero-summary"><Skeleton style={{ width: "70%", height: 25 }} /></div>
      </div>
      {toolbar && <div className="screen-toolbar"><Skeleton style={{ width: 120, height: 44, borderRadius: 24 }} /></div>}
    </div>
    <SkeletonRows count={4} />
  </SkeletonRegion>;
}

export function AppLoadingSkeleton({ recovery }: { recovery?: ReactNode } = {}) {
  return <div className="app-shell-root" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
    <div className="app-content">
      {recovery}
      <SkeletonRegion label="Loading your finances">
        <div className="app-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton style={{ width: 138, height: 44, borderRadius: 24 }} />
          <Skeleton style={{ width: 44, height: 44, borderRadius: "50%" }} />
        </div>
        <ScreenLoadingSkeleton label="Loading overview" toolbar={false} />
      </SkeletonRegion>
    </div>
  </div>;
}
