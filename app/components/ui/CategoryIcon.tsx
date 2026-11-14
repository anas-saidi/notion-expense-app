"use client";

import type { CSSProperties } from "react";
import { categoryIconSource, DEFAULT_CATEGORY_IMAGE } from "../../../lib/category-icons";

/** Category artwork has one transparent, consistently sized frame throughout the app.
 *  From 48px up the art feathers into the canvas; smaller icons stay crisp. */
const FEATHER_MIN_SIZE = 48;

export function CategoryIcon({ icon, categoryName, size = 22, style = {}, decorative = true, label }: {
  icon?: string | null;
  categoryName?: string | null;
  size?: number;
  style?: CSSProperties;
  decorative?: boolean;
  label?: string;
}) {
  return <span
    className="category-art"
    data-feather={size >= FEATHER_MIN_SIZE ? "" : undefined}
    role={!decorative ? "img" : undefined}
    aria-hidden={decorative ? "true" : undefined}
    aria-label={!decorative ? (label ?? categoryName ?? "Category") : undefined}
    style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size, width:size, height:size, flexShrink:0, lineHeight:1, verticalAlign:"middle", ...style }}
  >
    <img src={categoryIconSource(icon, categoryName)} alt="" width={size} height={size} decoding="async" draggable={false} style={{ display:"block", width:"100%", height:"100%", objectFit:"contain" }} onError={event => { if (event.currentTarget.getAttribute("src") !== DEFAULT_CATEGORY_IMAGE) event.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }} />
  </span>;
}
