# Liquid glass controls

The user requested Glisse for navigation, buttons and tabs, and explicitly deferred mascot redesign. Integration uses pinned `glisse@0.5.0` (MIT), with React 18 support and no additional transitive runtime dependencies. Reference: https://github.com/0kzh/glisse.

Shared integration: `ui/LiquidGlass.tsx`; product tuning: `ui/liquid-glass.css`. Glisse CSS is loaded before app overrides for server rendering, in addition to the library's client-side style insertion. Material colors follow the app theme; neutral primary actions preserve their existing emphasis.

Applied to floating navigation material and its moving selected destination, app header/desktop actions, Add transaction, shared ScreenChip filters, date/month triggers, Settings/Accounts close controls and Reflect's Spending/Activity switch. Main navigation retains native tab buttons and stable panel IDs; Glisse Glass supplies its material while CSS positions the selection. Reflect uses Glisse SegmentedControl directly. Financial rows, editable fields, charts and mascots retain their existing rendering.

Pattern evidence: [tab bar](https://mobbin.com/glossary/tab-bar) for top-level destinations; [segmented control](https://mobbin.com/glossary/segmented-control) for immediate mutually exclusive Reflect views. Controls preserve labels, disabled state, handlers, selection and dialog semantics.

| Rule | Change / validation | Status |
| --- | --- | --- |
| IC-02 | Shared wrappers and one tuning stylesheet; library version pinned in lockfile. | Pass by source/build inspection |
| IC-07 | Shared chips default to 44px targets; existing 44px actions and date controls retain sizing. Glisse provides material and press response. | Markup checked; live pointer behavior unverified |
| IC-08 | Main tablist now has roving tabIndex and arrows/Home/End; stable IDs and panel links retained. Date controls preserve dialog name/expanded state. | Five server-rendered integration checks pass; live keyboard/focus-return checks unverified |
| IC-12 | Existing responsive rail and phone navigation breakpoints retained. | Source checked; rendered layout unverified |
| IC-13 | Selection moves in 240ms; generic app hover lifts excluded from Glisse controls. Reduced motion removes spatial response. Reduced transparency/high contrast and missing backdrop-filter support receive opaque surfaces. | Source checked; OS preference playback unverified |
| IC-10 / IC-11 | No financial calculations, writes, loading states or error recovery changed. | App/lib suite passes |

Validation: TypeScript and final production build pass; 633 app/lib tests pass, 5 skip; five private server-rendered UI integration checks pass. Root first-load JS reported by Next grows from 253kB to 269kB (about 16kB). No content is marked as a Glisse backdrop source, avoiding its permanent content-following refraction loop. Material maps fit on idle/resize; Safari uses the library's native frosted fallback because live SVG backdrop refraction is Chromium-specific.

Internal-browser verification is blocked: CUA returns `Browser is not available: iab`; Codex open-in-panel request returns queued, and direct native access to the Codex app is prohibited by the tool. The user explicitly requested the internal browser, so no further Safari verification was performed. No phone/desktop visual acceptance or device performance claim is made. Local localhost:3000 continues serving the updated app for user review.
