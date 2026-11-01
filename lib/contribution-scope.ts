import { mirrorScope } from "./mirror/store";

/** A pinned contribution namespace survives a Notion credential rotation.
 * Other stores keep their existing namespaces and operation receipts.
 */
export function contributionScope(token: string): string {
  const configured = process.env.FINANCE_CONTRIBUTION_SCOPE?.trim();
  if (!configured) return mirrorScope(token);
  if (!/^[a-f0-9]{64}$/.test(configured)) throw Object.assign(new Error("The configured contribution namespace is invalid. Review FINANCE_CONTRIBUTION_SCOPE."), { status: 503 });
  return configured;
}
