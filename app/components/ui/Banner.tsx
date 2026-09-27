"use client";

import type { CSSProperties, ReactNode } from "react";

type BannerTone = "neutral" | "info" | "accent" | "warning" | "danger" | "success";

type BannerProps = {
  tone?: BannerTone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status" | "note";
  style?: CSSProperties;
  compact?: boolean;
};

const toneStyles: Record<BannerTone, { background: string; border: string; foreground: string }> = {
  neutral: {
    background: "var(--surface2)",
    border: "color-mix(in srgb, var(--border2) 40%, transparent)",
    foreground: "var(--text2)",
  },
  info: {
    background: "color-mix(in srgb, var(--info-dim) 58%, var(--surface))",
    border: "color-mix(in srgb, var(--info) 24%, transparent)",
    foreground: "color-mix(in srgb, var(--info) 58%, var(--text))",
  },
  accent: {
    background: "var(--select-wash)",
    border: "var(--select-edge)",
    foreground: "var(--text)",
  },
  warning: {
    background: "color-mix(in srgb, var(--warning-dim) 48%, var(--surface))",
    border: "color-mix(in srgb, var(--warning) 30%, transparent)",
    foreground: "color-mix(in srgb, var(--warning) 55%, var(--text))",
  },
  danger: {
    background: "color-mix(in srgb, var(--danger) 7%, var(--surface))",
    border: "color-mix(in srgb, var(--danger) 20%, transparent)",
    foreground: "color-mix(in srgb, var(--danger) 58%, var(--text))",
  },
  success: {
    background: "color-mix(in srgb, var(--success) 8%, var(--surface))",
    border: "color-mix(in srgb, var(--success) 22%, transparent)",
    foreground: "color-mix(in srgb, var(--success) 56%, var(--text))",
  },
};

export function Banner({ tone = "neutral", icon, title, children, action, role = "note", style, compact = false }: BannerProps) {
  const colors = toneStyles[tone];
  const sharedStyle: CSSProperties = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: icon ? "auto minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: compact ? 8 : 12,
    padding: compact ? "10px 12px" : "14px 16px",
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    background: colors.background,
    color: colors.foreground,
    boxSizing: "border-box",
    textAlign: "left",
    ...style,
  };
  const content = (
    <>
      {icon && <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>}
      <span style={{ minWidth: 0, display: "grid", gap: title && children ? 3 : 0 }}>
        {title && <strong style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{title}</strong>}
        {children && <span style={{ color: "inherit", fontSize: 12, lineHeight: 1.45 }}>{children}</span>}
      </span>
      {action && <span style={{ flexShrink: 0, justifySelf: "end" }}>{action}</span>}
    </>
  );

  return <div role={role} style={sharedStyle}>{content}</div>;
}

/** Neutral action for warning/error banners; shared with compact composer alerts. */
export const bannerActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  border: 0,
  borderRadius: "var(--radius-control)",
  background: "var(--text)",
  color: "var(--bg)",
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
