/** Find a property value by case-insensitive name match, trying formula/rollup/number types. */
const readNumericProp = (props: Record<string, any>, name: string): number | null => {
  const key = Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase());
  if (!key) return null;
  const p = props[key];
  return p?.formula?.number ?? p?.rollup?.number ?? p?.number ?? null;
};

export const mapCategoryPage = (page: any) => {
  const props = page.properties ?? {};
  const isTeamFund = props["Team Fund"]?.formula?.boolean ?? false;
  const typeValues = props.Type?.multi_select?.map((t: any) => t.name) ?? [];
  return {
    id: page.id,
    name: props.Category?.title?.[0]?.plain_text ?? "Unnamed",
    icon: page.icon?.emoji ?? null,
    type: typeValues,
    owner:
      props.Owner?.select?.name ??
      props.Owner?.people?.[0]?.name ??
      null,
    defaultAccount: props.Default?.relation?.[0]?.id ?? null,
    available: readNumericProp(props, "Available"),
    planned: props.Planned?.number ?? null,
    goal: props["Overall Goal"]?.number ?? null,
    goalDate: props["Goal Date"]?.date?.start ?? null,
    lastMonthSpent: readNumericProp(props, "Last month spent"),
    isTeamFund,
    snoozed: props.Snooze?.checkbox ?? false,
    archived: props.Archived?.checkbox ?? false,
  };
};

