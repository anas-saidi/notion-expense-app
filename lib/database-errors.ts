/** Quota exhaustion needs provider recovery, not immediate request retries. */
export function databaseQuotaFailure(error: unknown) {
  const failure = error as { code?: string; message?: string } | null;
  if (failure?.code !== "53000" || !/exceeded.*quota|quota.*exceeded/i.test(failure.message ?? "")) return null;
  return {
    error: "Shared database quota exceeded. Restore database access to refresh balance checks and contributions.",
    code: "DATABASE_QUOTA_EXCEEDED",
    retryable: false,
  } as const;
}

/** Explicit recovery mode is also non-retryable until its configuration changes. */
export function databaseUnavailableFailure(error: unknown) {
  const quota = databaseQuotaFailure(error);
  if (quota) return quota;
  const failure = error as { code?: string; message?: string } | null;
  return failure?.code === "DATABASE_NOTION_ONLY"
    ? { error: failure.message ?? "Shared database unavailable.", code: failure.code, retryable: false as const }
    : null;
}
