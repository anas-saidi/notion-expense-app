/** Explicit free recovery mode: use Notion for display reads without contacting Postgres. */
export function notionOnlyMode() {
  return process.env.FINANCE_NOTION_ONLY === "true";
}

export function assertSharedDatabaseEnabled() {
  if (notionOnlyMode()) throw Object.assign(
    new Error("Saved balance checks and contribution agreements are unavailable while reading directly from Notion."),
    { status: 503, code: "DATABASE_NOTION_ONLY", retryable: false },
  );
}
