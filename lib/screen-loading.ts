import type { AppTab } from "../app/components/app-types";

type ScreenLoading = {
  tab: AppTab; core: boolean; home: boolean; month: boolean; budget: boolean; bills: boolean; history: boolean;
  /** A refresh after a save or other change: the screen already shows data and has its own updating and retry state. */
  refreshing?: boolean;
};
/** Recovery belongs to the visible task; hidden Home reads must not make Activity look stalled. */
export function screenIsLoading(state: ScreenLoading): boolean {
  if (state.core) return true;
  if (state.refreshing) return false;
  if (state.tab === "history") return state.history;
  if (state.tab === "budget") return state.month || state.budget;
  return state.home || state.month || state.bills;
}
