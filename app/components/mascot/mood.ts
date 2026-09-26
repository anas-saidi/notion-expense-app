import { useEffect, useRef, useState } from "react";
import type { MascotTarget, ReactionKind } from "./engine";
import type { MascotScope, Mood } from "./poses";

/** The app data the mascot listens to. */
export interface MascotSignals {
  scope: MascotScope;
  /** Joint shortfall in MAD (ContributionStatus.fundingGap). */
  fundingGap: number;
  /** Spent ÷ planned this month, in %; null without a plan. */
  spentPct: number | null;
  /** Unassigned money in the scope, in MAD. */
  unassigned: number;
  loading: boolean;
}

/** MAD at which the joint lobes are ~63% of the way apart; the curve never quite reaches 1. */
const GAP_SOFTNESS = 2000;

/** Resting state, from budget health. Reactions are layered on top separately. */
export function deriveTarget(s: MascotSignals): MascotTarget {
  const isJoint = s.scope === "joint";
  const funded = isJoint && s.fundingGap <= 0.005;
  let mood: Mood = "idle";
  if (s.loading) mood = "sleepy";
  else if (s.spentPct !== null && s.spentPct >= 100) mood = "sad";
  else if (s.spentPct !== null && s.spentPct >= 85) mood = "worried";
  else if (s.unassigned > 0.5) mood = "curious";
  else if (funded) mood = "happy";
  return {
    scope: s.scope,
    gap: isJoint ? 1 - Math.exp(-Math.max(0, s.fundingGap) / GAP_SOFTNESS) : 0,
    mood,
    celebrate: funded && !s.loading && mood === "happy",
  };
}

/** A balance change becomes a short reaction, scaled against what's left to spend. */
export function reactionForBalanceChange(delta: number, available: number): ReactionKind | null {
  if (Math.abs(delta) < 0.5) return null;
  if (delta > 0) return "cheer";
  return Math.abs(delta) > Math.max(available, 1) * 0.25 ? "wince" : "dip";
}

export interface ReactionToken { kind: ReactionKind; id: number }

/**
 * Emits a reaction when the balance of the SAME scope changes. Switching scope
 * is a shape change, not a money event, so it resets the baseline silently.
 */
export function useBalanceReaction(balance: number | null, scope: MascotScope, available: number): ReactionToken | null {
  const last = useRef<{ scope: MascotScope; balance: number | null }>({ scope, balance });
  const [token, setToken] = useState<ReactionToken | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { scope, balance };
    if (prev.scope !== scope || prev.balance === null || balance === null) return;
    const kind = reactionForBalanceChange(balance - prev.balance, available);
    if (kind) setToken(t => ({ kind, id: (t?.id ?? 0) + 1 }));
  }, [balance, scope, available]);
  return token;
}
