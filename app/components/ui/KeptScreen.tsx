"use client";

import { createContext, useContext, type ReactNode } from "react";

const ScreenActive = createContext(true);
/** False inside a primary screen that is kept mounted but hidden; one-time moments wait until it shows. */
export const useScreenActive = () => useContext(ScreenActive);

/**
 * A primary screen (Home, Budget, Reflect) stays mounted after its first visit and is only hidden when
 * another tab shows. Switching back is then a show, not a rebuild: the hero light isn't drawn again and
 * scroll, filters and open sections keep their state. Active, the wrapper adds no box (display: contents).
 */
export function KeptScreen({ active, children }: { active: boolean; children: ReactNode }) {
  return <div hidden={!active} style={active ? { display: "contents" } : undefined}>
    <ScreenActive.Provider value={active}>{children}</ScreenActive.Provider>
  </div>;
}
