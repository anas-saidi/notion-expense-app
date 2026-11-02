"use client";

import { useEffect, useState } from "react";

/** Stay quiet for normal reads; give prolonged reads a keyboard-accessible restart. */
export function LoadingRecovery({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, [loading, attempt]);
  if (!loading || !slow) return null;
  return <div className="loading-recovery">
    <span role="status">Still loading.</span>
    <button type="button" onClick={() => { setSlow(false); setAttempt(value => value + 1); onRetry(); }}>Retry</button>
  </div>;
}
