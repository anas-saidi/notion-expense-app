"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { CheckIcon } from "./icons";
import { Button } from "./Button";
import "./toast.css";

/**
 * The app's one toast (design.md, Shared components): a short, transient confirmation or failure of
 * something the user just did. One at a time; a new toast replaces the current one.
 *
 *   showToast("Transaction updated", { tone: "success" });
 *   showToast("Transaction deleted", { action: { label: "Undo", onClick: restore } });
 *   showToast(error.message, { tone: "error" });
 *
 * A state that persists on a surface (an error loading a screen, a warning on a form) is a Banner, never a toast.
 */

export type ToastTone = "neutral" | "success" | "error";

export type ToastAction = {
  /** One or two words: Undo, Retry, View. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type ToastMessage = {
  /** Changes for every new toast so a repeated message replays its entrance. */
  id: number;
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
};

export type ToastOptions = {
  tone?: ToastTone;
  action?: ToastAction;
  /** Milliseconds on screen. Defaults: 2400 (neutral, success), 4000 (error), 8000 with an action. */
  duration?: number;
};

/** How long a toast stays when the caller does not say (used by the owner of the toast state). */
export function toastDuration(options: ToastOptions = {}): number {
  if (options.duration != null) return options.duration;
  if (options.action) return 8000;
  return options.tone === "error" ? 4000 : 2400;
}

const EXIT_MS = 160;

export function Toast({ toast }: { toast: ToastMessage | string | null | undefined }) {
  const next: ToastMessage | null = toast == null || toast === "" ? null : typeof toast === "string" ? { id: 0, message: toast } : toast;
  const [shown, setShown] = useState<ToastMessage | null>(next);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const nextKey = next ? `${next.id}:${next.message}` : "";

  useEffect(() => {
    if (exitTimer.current) { window.clearTimeout(exitTimer.current); exitTimer.current = null; }
    if (next) {
      setShown(next);
      setLeaving(false);
      return;
    }
    // Keep the last toast mounted while it fades out, so it never just vanishes.
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => { setShown(null); setLeaving(false); exitTimer.current = null; }, EXIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, next?.action?.disabled, next?.action?.label, next?.tone]);

  useEffect(() => () => { if (exitTimer.current) window.clearTimeout(exitTimer.current); }, []);

  const tone = shown?.tone ?? "neutral";
  return (
    // The live region stays mounted so screen readers announce each new message.
    <div className="ui-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {shown && (
        <div
          key={`${shown.id}:${shown.message}`}
          className="ui-toast"
          data-tone={tone}
          data-leaving={leaving ? "" : undefined}
          data-action={shown.action ? "" : undefined}
          role={tone === "error" ? "alert" : undefined}
        >
          {tone !== "neutral" && (
            <span className="ui-toast-icon" aria-hidden="true">
              {tone === "success" ? <CheckIcon size={16} /> : <CircleAlert size={16} />}
            </span>
          )}
          <span className="ui-toast-message">{shown.message}</span>
          {shown.action && (
            <Button variant="quiet" size="compact" className="ui-toast-action" disabled={shown.action.disabled || leaving} onClick={shown.action.onClick}>
              {shown.action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
