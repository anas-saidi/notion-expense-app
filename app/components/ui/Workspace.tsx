"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockModalBackground } from "./modal-background";
import "./workspace.css";

/** How long the exit plays before unmounting (exit is faster than enter). */
const EXIT_MS = 200;

/**
 * A focused workspace for a big task (Rebalance): it covers the app, holds one job, and ends in
 * Cancel or Save. Phones: a full-screen cover that slides up like a sheet. Desktop: the whole window,
 * fading and scaling in from 0.98. A dialog: the app behind is inert, focus moves in and comes back
 * on close, and Escape closes unless a control inside already used it (an input cancelling a draft).
 */
export function Workspace({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false); return; }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => { setMounted(false); setLeaving(false); }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !mounted) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const app = document.querySelector<HTMLElement>(".app-shell-root");
    const release = app ? lockModalBackground(app) : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first control after the enter frame, so the slide isn't interrupted by a scroll.
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>("[data-autofocus], button, [href], input, select, textarea")?.focus({ preventScroll: true });
    });
    // Escape closes from anywhere while open (focus may be on the page after an input blurs),
    // unless a control inside already used it, e.g. an input cancelling its draft.
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); closeRef.current(); } };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      release?.();
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus?.({ preventScroll: true });
    };
  }, [open, mounted]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="workspace" data-leaving={leaving || undefined}>
      <div
        ref={panel}
        className="workspace-panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
