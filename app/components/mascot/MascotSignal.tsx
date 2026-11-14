"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import "./mascot-signal.css";

/**
 * Bloub's signal language for our jars: the body itself becomes the message, then forms back.
 * One signal per jar at a time, in priority order (`pickSignal`): alert, thinking, dot, sleep.
 *
 * - dot: something here needs you (a small dot at the top right; red when money is due or short).
 * - thinking: Gemini is working (the body collapses into three dots).
 * - sleep: nothing to show, or offline (the body settles into one breathing dot).
 * - alert: something failed (the body becomes a "!"; tap for the reason).
 *
 * One-offs play once from an `once` token: wink lives in the engine (see `reaction`), burst throws
 * specks out from the jar (goal reached), comet streaks the body away and back (money moved).
 * Reduce Motion: nothing morphs; thinking and sleep show a quiet static dot, one-offs are skipped.
 * The jar stays decorative: every signal is also stated in text nearby, and `label` is announced.
 */
export type SignalKind = "dot" | "thinking" | "sleep" | "alert";
export type OnceKind = "burst" | "comet";

export function pickSignal(flags: Partial<Record<SignalKind, boolean>>): SignalKind | null {
  return flags.alert ? "alert" : flags.thinking ? "thinking" : flags.dot ? "dot" : flags.sleep ? "sleep" : null;
}

export function MascotSignal({ signal, tone = "neutral", label, caption = false, dotAt, onAlertTap, once, children }: {
  signal: SignalKind | null;
  /** Dot colour: danger only for money due or short. */
  tone?: "danger" | "neutral";
  /** What the signal means, for screen readers. */
  label?: string;
  /** Where the dot sits on this body (top plus left or right), when the default shoulder misses it. */
  dotAt?: Pick<CSSProperties, "top" | "left" | "right">;
  /** Show `label` under the jar, when nothing else on screen says it. */
  caption?: boolean;
  /** Alert: tapping the "!" (e.g. show the reason and Retry). */
  onAlertTap?: () => void;
  /** A one-off to play now; `id` is the Date.now() of the event, and a new id plays it again. */
  once?: { kind: OnceKind; id: number } | null;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const takeover = !reduce && (signal === "thinking" || signal === "sleep" || signal === "alert");
  const [playing, setPlaying] = useState<OnceKind | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    // Ids are Date.now() stamps: a screen that mounts after the moment passed doesn't replay it.
    if (!once || reduce || Date.now() - once.id > 2500) return;
    setPlaying(once.kind);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(null), once.kind === "comet" ? 1000 : 800);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [once?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className="mascot-signal" data-signal={signal ?? undefined} data-takeover={takeover || undefined} data-once={playing ?? undefined}>
    <span className="mascot-signal-body">{children}</span>
    {/* Body-takeover signals grow from where the body shrank to. */}
    {signal === "thinking" && <span className="mascot-signal-center" aria-hidden="true">
      {reduce ? <span className="mascot-signal-quiet" /> : <span className="mascot-signal-thinking"><i /><i /><i /></span>}
    </span>}
    {signal === "sleep" && <span className="mascot-signal-center" aria-hidden="true"><span className="mascot-signal-sleep" /></span>}
    {signal === "alert" && (onAlertTap
      ? <button type="button" className="mascot-signal-center mascot-signal-alert-button" aria-label={label ?? "Something went wrong"} onClick={onAlertTap}><span className="mascot-signal-alert"><i /><i /></span></button>
      : <span className="mascot-signal-center" aria-hidden="true"><span className="mascot-signal-alert"><i /><i /></span></span>)}
    {signal === "dot" && <span className="mascot-signal-dot" data-tone={tone} aria-hidden="true" style={dotAt && { right: "auto", ...dotAt }} />}
    {playing === "burst" && <span className="mascot-signal-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 45}deg` }} />)}</span>}
    {playing === "comet" && <span className="mascot-signal-comet" aria-hidden="true"><i /></span>}
    {label && signal && signal !== "alert" && <span className={caption ? "mascot-signal-caption" : "sr-only"} role="status">{label}</span>}
  </span>;
}

/** Play a one-off once per key on this device (e.g. a savings goal reached), when `when` turns true. */
export function useOnceSignal(key: string, when: boolean, kind: OnceKind) {
  const [token, setToken] = useState<{ kind: OnceKind; id: number } | null>(null);
  useEffect(() => {
    if (!when) return;
    try {
      const storeKey = `mascot-once:${key}`;
      if (localStorage.getItem(storeKey)) return;
      localStorage.setItem(storeKey, new Date().toISOString());
    } catch { return; }
    setToken({ kind, id: Date.now() });
  }, [key, when, kind]);
  return token;
}
