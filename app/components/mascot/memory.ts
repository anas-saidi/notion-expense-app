"use client";
import { useEffect, useState } from "react";
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
 */
export function useRememberedJar<T>(key: string | null, kind: "items" | "level", current: T, animate: boolean): T {
  const [start] = useState<T>(() => (key && animate && typeof window !== "undefined" ? startFrom(kind, read(key), current) : current));
  const [revealed, setRevealed] = useState(start === current);

  useEffect(() => {
    if (revealed) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [revealed]);

  const serialised = JSON.stringify(current);
  useEffect(() => {
    if (key && revealed) write(key, current);
  }, [key, serialised, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return revealed ? current : start;
}
