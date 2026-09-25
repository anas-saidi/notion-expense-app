import { scopeFromAccountLabel } from "../app/components/app-utils";

// The account's own title decides the expected owners; client-sent scope is never trusted.
export function accountOwnerScope(properties: Record<string, any>): string | null {
  const title = Object.values(properties ?? {}).find((value: any) => value?.type === "title") as any;
  const label = (title?.title ?? []).map((part: { plain_text?: string }) => part.plain_text ?? "").join("");
  // Savings accounts can be personal or shared, so their owners are taken as-is.
  if (!label || label.toLowerCase().includes("saving")) return null;
  return scopeFromAccountLabel(label);
}

// Use the selected account's actual Notion identities, never display-name guesses.
// With no recognizable scope, accept any one- or two-owner account as-is.
export function categoryOwnerPeople(properties: Record<string, any>, scope: string | null): { id: string }[] {
  const owner = Object.entries(properties ?? {}).find(([name, value]) => name.toLowerCase() === "owner" && value.type === "people")?.[1];
  const ids = [...new Set<string>((owner?.people ?? []).map((person: { id: string }) => person.id).filter(Boolean))];
  const valid = scope === null ? ids.length === 1 || ids.length === 2 : ids.length === (scope === "joint" ? 2 : 1);
  if (!valid) {
    throw new Error(scope === "joint"
      ? "The joint account must have both partners as owners before saving a category"
      : scope === null
        ? "The selected account must have one or two owners before saving a category"
        : "The selected account must have one owner before saving a category");
  }
  return ids.map(id => ({ id }));
}
