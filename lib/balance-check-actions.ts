import { accountKey, type BalanceCheckView } from "./balance-checks";

type Change = { action: "save" | "close"; accountId: string; actualBalance: number; expectedVersion: string | null };
type Effects = {
  committed: (check: BalanceCheckView | null) => void;
  refresh?: () => Promise<void>;
  refreshFailed?: () => void;
};

/** The acknowledged mutation completes the save. Refreshing other checks must
 * neither prolong that save nor turn a confirmed write into a save failure. */
export async function changeBalanceCheck(change: Change, effects: Effects): Promise<void> {
  const response = await fetch("/api/balance-checks", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not save the check.");
  const check = data.check;
  const savedCheck = typeof check?.version === "string" && check.version.length > 0 && typeof check.accountId === "string"
    && accountKey(check.accountId) === accountKey(change.accountId) && Number.isFinite(check.actualBalance) && Number.isFinite(check.estimatedActual);
  if (change.action === "save" ? !savedCheck : data.success !== true) {
    throw new Error("Could not confirm the balance check response. Review the saved check before retrying.");
  }
  effects.committed(data.check ?? null);
  if (effects.refresh) void Promise.resolve().then(effects.refresh).catch(() => effects.refreshFailed?.());
}
