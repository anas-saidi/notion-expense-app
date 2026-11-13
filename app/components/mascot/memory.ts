"use client";
import { useEffect, useRef, useState } from "react";
import type { JarItem } from "./coinSimMatter";

/**
 * What a hero jar last showed on this device, so the next visit can start from
 * there and animate only what changed: new emojis drop in, removed ones fade,
 * the pool eases from its old level. Per-viewer convenience only: when storage
 * is unavailable the jar just appears settled.
 */

const PREFIX = "mascot-seen:";
/** Let the screen appear first, so the change is seen rather than missed. */
const REVEAL_DELAY_MS = 350;

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the next visit just starts settled.
  }
}

/** Stored items, or null if there's no valid record. */
export function parseSeenItems(value: unknown): JarItem[] | null {
  if (!Array.isArray(value)) return null;
  const ok = value.every(v => v && typeof v.id === "string" && typeof v.glyph === "string" && typeof v.radius === "number" && Number.isFinite(v.radius) && v.radius > 0);
  return ok ? (value as JarItem[]) : null;
}

/** A stored level, or null if there's no valid record. */
export function parseSeenLevel(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

/**
 * Where a jar starts on this visit, given what was last seen:
 * - items: the jar exactly as it was left; the very first time, empty (a one-off full fill);
 * - level: the last level; the very first time, already at the current level (no entrance).
 * Without storage (undefined) it starts settled.
 */
export function startFrom<T>(kind: "items" | "level", seen: unknown, current: T): T {
  if (seen === undefined) return current;
  if (kind === "items") return (parseSeenItems(seen) ?? (seen === null ? [] : current)) as T;
  return (parseSeenLevel(seen) ?? current) as T;
}

/**
 * Shows the remembered state first, then the current one a moment after the
 * jar appears, and remembers the current one for next time. A null key turns
 * it off; `animate: false` (Reduce Motion) still remembers but always shows
 * the current state.
 *
 * `pending` means the current state isn't known yet (its data is still
 * loading): the jar holds what it last showed, or the remembered state on a
 * fresh visit, so it can appear before the data does. Nothing is remembered
 * until the real state arrives; then it moves there as usual.
 */
export function useRememberedJar<T>(key: string | null, kind: "items" | "level", current: T, animate: boolean, pending = false): T {
  const startFor = (forKey: string | null) =>
    forKey && (animate || pending) && typeof window !== "undefined" ? startFrom(kind, read(forKey), current) : current;
  const [entry, setEntry] = useState(() => ({ key, start: startFor(key) }));
  const [revealed, setRevealed] = useState(entry.start === current);
  const shown = useRef<T>(entry.start);

  // A different scope is a new context, not a deposit/spending event. Keep the
  // mascot mounted, but discard the old context's delayed reveal. Adjust state
  // before commit so even a switch during the first 350ms cannot show old items.
  if (entry.key !== key) {
    const start = pending ? startFor(key) : current;
    shown.current = start;
    setEntry({ key, start });
    if (!revealed) setRevealed(true);
  }

  useEffect(() => {
    if (revealed || pending) return;
    if (!animate) { setRevealed(true); return; }
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [revealed, animate, key, pending]);

  const serialised = JSON.stringify(current);
  useEffect(() => {
    if (key && revealed && !pending) write(key, current);
  }, [key, serialised, revealed, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pending) return shown.current;
  const result = !animate || entry.key !== key || revealed ? current : entry.start;
  shown.current = result;
  return result;
}
