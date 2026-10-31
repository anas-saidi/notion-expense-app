# Desktop finance composition references

User-provided references, 31 October 2026.

- [Dashboard composition](desktop-overview.png): a wide balance surface beside monthly context, followed by three distinct finance sections.
- [Navigation rail](desktop-navigation.png): a slim icon rail with primary destinations grouped centrally and utility actions below.

Implemented in `app/components/desktop-dashboard.css`, `AppShell.tsx`, `BottomNav.tsx`, `HomeScreen.tsx` and `DesktopHomeOverview.tsx`. Our existing financial data, mascots, semantic colors, typography, controls and mobile layout remain the visual authority. The reference branding and promotional features are not part of this implementation.

Verification: production build and TypeScript checks passed. The live desktop was inspected in dark and light appearance, including the saved repayment and unresolved-balance records. An existing service-worker fetch error interfered with the first preview; the new desktop was inspected at the fresh `127.0.0.1:3001` origin. Phone rules remain scoped below the desktop breakpoint; final 430x932 device emulation could not be completed because the browser process closed during the check.
