/** Clear only the future month's saved allocation before freezing metadata.
 * Notify the caller after clearing, even if the following freeze fails. */
export async function freezeMonthPlanCategory({ month, categoryId, hasSavedAllocation, onAllocationCleared }: {
  month: string;
  categoryId: string;
  hasSavedAllocation: boolean;
  onAllocationCleared: () => void;
}) {
  if (hasSavedAllocation) {
    const response = await fetch("/api/monthly-planning/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, allowClear: true, budgetItems: [{ categoryId, amount: 0 }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't clear the monthly allocation");
    onAllocationCleared();
  }
  const response = await fetch("/api/categories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: categoryId, snoozed: true }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't freeze the category");
}
