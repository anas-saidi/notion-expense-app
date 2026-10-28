"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BalanceCheckView } from "../../lib/balance-checks";

export function useBalanceChecks() {
  const [checks, setChecks] = useState<BalanceCheckView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch("/api/balance-checks", { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load balance checks.");
      if (request === sequence.current) { setChecks(data.checks); setError(null); }
    } catch (error) {
      if (request === sequence.current) setError(error instanceof Error ? error.message : "Balance checks unavailable.");
    } finally { if (request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => { sequence.current++; window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); window.clearInterval(timer); };
  }, [refresh]);
  return { checks, error, loading, refresh };
}
