"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import type { ReactNode } from "react";
import { CheckIcon } from "./ui/icons";
import { EmptyState } from "./ui/EmptyState";
import { useAppHaptics } from "./ui/useAppHaptics";
import "./filter-checklist.css";

export type FilterChecklistItem = { id: string; name: string; art?: ReactNode; detail?: ReactNode };

/**
 * A multi-select list for including items in a view (Reflect's spending filter).
 * Base UI's CheckboxGroup with a parent checkbox: the top row selects all or none and shows
 * the mixed state, so there are no separate All and None buttons. Rows sit on one shared surface.
 */
export function FilterChecklist({ title, items, excluded, onExcludedChange }: {
  title: string;
  items: FilterChecklistItem[];
  excluded: string[];
  onExcludedChange: (excluded: string[]) => void;
}) {
  const { haptic } = useAppHaptics();
  const allIds = items.map(item => item.id);
  const included = allIds.filter(id => !excluded.includes(id));
  const setIncluded = (next: string[]) => {
    haptic("selection");
    onExcludedChange(allIds.filter(id => !next.includes(id)));
  };
  const titleId = `filter-${title.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <section className="filter-checklist" aria-labelledby={titleId}>
      <h3 id={titleId} className="section-label filter-checklist-title">{title}</h3>
      {!items.length
        ? <EmptyState>No {title.toLowerCase()} in this period.</EmptyState>
        : <CheckboxGroup value={included} onValueChange={setIncluded} allValues={allIds} className="filter-checklist-surface" aria-labelledby={titleId}>
          <label className="filter-checklist-row filter-checklist-parent">
            <span className="filter-checklist-text">
              <span className="filter-checklist-name">All {title.toLowerCase()}</span>
              <span className="filter-checklist-detail">{included.length === allIds.length ? "Showing all" : `${included.length} of ${allIds.length} shown`}</span>
            </span>
            <FilterCheckbox parent />
          </label>
          {items.map(item => (
            <label key={item.id} className="filter-checklist-row">
              {item.art && <span className="filter-checklist-art" aria-hidden="true">{item.art}</span>}
              <span className="filter-checklist-text">
                <span className="filter-checklist-name">{item.name}</span>
                {item.detail && <span className="filter-checklist-detail">{item.detail}</span>}
              </span>
              <FilterCheckbox value={item.id} />
            </label>
          ))}
        </CheckboxGroup>}
    </section>
  );
}

function FilterCheckbox(props: { value?: string; parent?: boolean }) {
  return (
    <Checkbox.Root {...props} className="filter-checkbox">
      <Checkbox.Indicator className="filter-checkbox-indicator" keepMounted render={(indicatorProps, state) => (
        <span {...indicatorProps}>{state.indeterminate ? <span className="filter-checkbox-dash" /> : <CheckIcon size={16} aria-hidden="true" />}</span>
      )} />
    </Checkbox.Root>
  );
}
