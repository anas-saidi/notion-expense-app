"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountKey } from "../../lib/balance-checks";
import type { BalanceCheckView, BalanceCountReview } from "../../lib/balance-checks";

export function useBalanceChecks() {
  const [checks, setChecks] = useState<BalanceCheckView[]>([]);
  const [reviewCounts, setReviewCounts] = useState<BalanceCountReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // A non-retryable failure (shared database off or out of quota) won't change until the
  // server is reconfigured, so stop asking and say so instead of offering Retry.
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (pausedRef.current) return;
    const request = ++sequence.current;
    try {
      const response = await fetch("/api/balance-checks", { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok && data.retryable === false) pausedRef.current = true;
      if (!response.ok) throw new Error(data.error ?? "Could not load balance checks.");
      if (request === sequence.current) { setChecks(data.checks); setReviewCounts(data.reviewCounts ?? []); setError(null); }
    } catch (error) {
      if (request === sequence.current) { setError(error instanceof DOMException || error instanceof TypeError ? "Balance checks are slow to load right now." : error instanceof Error ? error.message : "Balance checks unavailable."); setPaused(pausedRef.current); }
    } finally { if (request === sequence.current) setLoading(false); }
  }, []);
  const applySavedCheck = useCallback((accountId: string, check: BalanceCheckView | null) => {
    // A read started before this acknowledged save must not overwrite its receipt.
    sequence.current++;
    const id = accountKey(accountId);
    setChecks(current => [...current.filter(row => accountKey(row.accountId) !== id), ...(check ? [check] : [])]);
    setReviewCounts(current => current.filter(row => accountKey(row.accountId) !== id));
    pausedRef.current = false; setPaused(false); setError(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => { sequence.current++; window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); window.clearInterval(timer); };
  }, [refresh]);
  return { checks, reviewCounts, error, paused, loading, refresh, applySavedCheck };
}
