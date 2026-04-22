import React, { useState } from "react";
import { TrashIcon } from "./DelightIcons";

export function DelightTrashButton({ isDeleting }: { isDeleting: boolean }) {
  const [hover, setHover] = useState(false);
  const [shake, setShake] = useState(false);

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShake(false); }}
      onMouseDown={() => setShake(true)}
      onMouseUp={() => setShake(false)}
    >
      <TrashIcon open={hover || isDeleting} shake={shake || isDeleting} style={{ color: isDeleting ? "#e11d48" : undefined, transition: "color 0.2s" }} />
    </span>
  );
}