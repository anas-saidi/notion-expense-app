"use client";

import { useEffect, useState } from "react";
import { Banner } from "./Banner";
import { Button } from "./Button";

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
  return <Banner className="loading-recovery" tone="neutral" role="status" compact
    action={<Button variant="quiet" size="compact" onClick={() => { setSlow(false); setAttempt(value => value + 1); onRetry(); }}>Retry</Button>}>
    Still loading.
  </Banner>;
}
