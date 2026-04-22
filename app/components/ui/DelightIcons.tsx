import React, { useRef } from "react";

// Trash (delete) icon with animated lid
export function TrashIcon({
  open = false,
  shake = false,
  ...props
}: {
  open?: boolean;
  shake?: boolean;
  [key: string]: any;
}) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 0.15s cubic-bezier(.7,1.7,.7,1)",
        transform: shake ? "rotate(-8deg) scale(1.08)" : undefined,
      }}
      {...props}
    >
      <g>
        <rect x="6" y="9" width="12" height="9" rx="2.5" fill="#fff" stroke="currentColor" />
        <rect
          x="9.5"
          y="3.5"
          width="5"
          height="3"
          rx="1.2"
          fill="#fff"
          stroke="currentColor"
          style={{
            transform: open ? "rotate(-25deg) translate(-2px, -4px)" : "none",
            transformOrigin: "center left",
            transition: "transform 0.18s cubic-bezier(.7,1.7,.7,1)",
          }}
        />
        <line x1="10" y1="13" x2="10" y2="17" />
        <line x1="14" y1="13" x2="14" y2="17" />
      </g>
    </svg>
  );
}

// Full screen icon (expand)
export function FullScreenIcon({ expanded = false, ...props }: { expanded?: boolean; [key: string]: any }) {
  return expanded ? (
    // Exit full screen (contract)
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...props}>
      <polyline points="7 15 7 19 11 19" />
      <polyline points="15 7 19 7 19 11" />
      <line x1="7" y1="15" x2="15" y2="7" />
    </svg>
  ) : (
    // Enter full screen (expand)
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...props}>
      <polyline points="7 7 7 3 11 3" />
      <polyline points="15 15 19 15 19 11" />
      <line x1="7" y1="7" x2="15" y2="15" />
    </svg>
  );
}

// Close (X) icon
export function CloseIcon(props: any) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
