import type { CSSProperties, ReactNode } from "react";

/** One visual treatment for pending content; decorative shapes stay out of the accessibility tree. */
export function Skeleton({ style }: { style?: CSSProperties }) {
  return <span aria-hidden="true" className="skeleton" style={{ display: "block", height: 14, width: "100%", ...style }} />;
}

export function SkeletonRegion({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return <div role="status" aria-label={label} aria-busy="true" style={style}>{children}</div>;
}

export function HeroSkeleton({ label = "Loading monthly details", size = 175 }: { label?: string; size?: number }) {
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

export function AppLoadingSkeleton() {
  return <div className="app-shell-root" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
    <div className="app-content">
      <SkeletonRegion label="Loading your finances">
        <div className="app-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton style={{ width: 138, height: 44, borderRadius: 24 }} />
          <Skeleton style={{ width: 44, height: 44, borderRadius: "50%" }} />
        </div>
        <div style={{ padding: "16px 0 32px", display: "grid", justifyItems: "center", gap: 16 }}>
          <Skeleton style={{ width: 126, height: 147, borderRadius: 40 }} />
          <Skeleton style={{ width: 64, height: 12 }} />
          <Skeleton style={{ width: 180, height: 56, borderRadius: 12 }} />
          <Skeleton style={{ width: 120, height: 14 }} />
        </div>
        <Skeleton style={{ width: 76, height: 12, marginBottom: 12 }} />
        <SkeletonRows count={4} />
      </SkeletonRegion>
    </div>
  </div>;
}
