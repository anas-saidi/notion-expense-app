import React, { useState } from "react";
import { FullScreenIcon } from "./DelightIcons";

export function FullScreenDelightIcon({ expanded }: { expanded: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 0.18s cubic-bezier(.7,1.7,.7,1)", transform: hover ? "scale(1.13)" : undefined }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <FullScreenIcon expanded={expanded} style={{ color: expanded ? "#0284c7" : undefined, transition: "color 0.2s" }} />
    </span>
  );
}