"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
export type ButtonSize = "regular" | "compact";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Action level (design.md, Shared components): primary is the one main action of a surface. */
  variant?: ButtonVariant;
  /** regular: 48px, 15px label (sheet footers, dialogs). compact: 44px, 13px label (toolbars, rows, inline). */
  size?: ButtonSize;
  /** Stretch to the container width (sheet footers on phone). */
  block?: boolean;
  /** Optional leading Lucide icon; decorative, the label names the action. */
  icon?: ReactNode;
  /**
   * The action is running: the label becomes `loadingLabel` and the button is disabled and busy.
   * This changes the label only; blocking the surface is SavingCover's job.
   */
  loading?: boolean;
  /** Label while loading, e.g. "Saving". Defaults to the normal label. */
  loadingLabel?: ReactNode;
  children: ReactNode;
};

/** The app's one button. Pick the variant by action level, never by screen. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "regular", block = false, icon, loading = false, loadingLabel, type = "button", disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={className ? `ui-button ${className}` : "ui-button"}
      data-variant={variant}
      data-size={size}
      data-block={block ? "" : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <span className="ui-button-icon" aria-hidden="true">{icon}</span>}
      <span className="ui-button-label">{loading && loadingLabel !== undefined ? loadingLabel : children}</span>
    </button>
  );
});
