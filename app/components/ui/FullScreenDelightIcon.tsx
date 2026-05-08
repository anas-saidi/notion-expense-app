import { FullScreenIcon } from "./icons";
import type { LucideProps } from "lucide-react";

export function FullScreenDelightIcon({
  expanded,
  style,
  ...props
}: LucideProps & { expanded: boolean }) {
  return (
    <FullScreenIcon
      expanded={expanded}
      style={{
        color: expanded ? "var(--info)" : undefined,
        transition: "color 0.2s ease",
        ...style,
      }}
      {...props}
    />
  );
}
