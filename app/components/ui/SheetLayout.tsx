import type { ComponentPropsWithoutRef } from "react";

/** Shared anatomy; consumer styles can arrange content without redefining dialog chrome. */
export function SheetBody({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={`sheet-body ${className}`} />;
}

export function SheetHeader({ className = "", ...props }: ComponentPropsWithoutRef<"header">) {
  return <header {...props} className={`sheet-header ${className}`} />;
}

export function SheetFooter({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={`sheet-footer ${className}`} />;
}
