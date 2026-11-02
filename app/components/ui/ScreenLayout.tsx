import type { ReactNode } from "react";

/** Period and screen-specific controls live outside the primary metric. */
export function ScreenToolbar({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`screen-toolbar ${className}`} role="group" aria-label={label}>{children}</div>;
}
