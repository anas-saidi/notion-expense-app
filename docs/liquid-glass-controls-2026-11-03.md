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

## Follow-up: visible library components

The user reports no visible liquid glass. Source inspection confirms the first pass kept a custom phone selection, hid its glass layers on desktop, toned refraction down from Glisse defaults and left Add opaque. Those choices made the integration too subtle and omitted the library’s main tab-bar interaction.

Phone navigation now renders Glisse TabBar directly, with its draggable/held refractive selection. Width follows the existing fluid navigation rail. Desktop has a visible Glass enclosure and Button destinations rather than hiding every material layer. Add now uses clear Glisse Button styling. Restored default 0.45 bend, 0.4 dispersion and 3px frost. Selected desktop destinations retain Glisse’s filter variable, rather than overriding it with blur alone.

Phone and desktop have separate tablists, with exactly one exposed by the existing breakpoint. Desktop retains original IDs; a small layout-effect bridge adds per-item phone IDs/controls (not exposed by Glisse’s item API) and points the active panel label at the visible tablist. Reduced-motion/transparency and contrast fallbacks remain.

Validation: 633 app/lib tests pass, TypeScript passes and production build passes. Five SSR integration checks now assert actual Glisse TabBar/lens markup plus desktop panel links. Local CSS response confirms the phone tab bar, visible desktop glass rail and restored default refraction. Internal-browser control remains unavailable (`iab`), so visual appearance/hold-drag interaction are still unverified; no external browser was substituted.

## Follow-up: Reflect switch geometry and dark material

The supplied dark phone screenshot shows the resting selected pill protruding beneath the track. Glisse's segmented root defaults to no outer padding. The app set `--lg-tab-inset:3px`, which moved the thumb but never added that track padding. A 44px track therefore contained a 40px thumb starting at 5px, ending at 45px. Apply actual 3px padding and derive the capsule radius from the padded 50px height: the same thumb now has 5px clearance above and below, and equal horizontal clearance. Keep overflow visible so the held lens can lift as intended.

The dark resting thumb uses 14% light neutral instead of the library's 30%, with a fine specular edge. Selected labels use stronger text/weight. Remove the reduced custom 10px/6px lens growth, allowing the package's native 24px/16px held lens. Keep capsule-shaped keyboard focus and preserve the stronger opaque-thumb border under reduced transparency/high contrast.

Validation: source geometry checked against the installed library's thumb calculations; production build passed. This CSS-only fix does not run database diagnostics or change financial behavior. Internal browser still reports `iab` unavailable, so rendered dark/light and hold/drag playback remain unverified; no external browser substituted.

## Follow-up: unframed Reflect views

The user selected one glass pill for the active view and plain text for the inactive view. Remove the outer track material, keeping its measured geometry for Glisse. Zero outer/thumb insets align the selected pill with its 44px target. Preserve the held lens, radio semantics, keyboard focus and existing view handlers. The selected pill uses neutral glass in both themes, with opaque accessibility fallbacks. This supersedes the enclosing-track treatment above.

Validation: production build and served asset checks are recorded with the release. Internal browser control is unavailable in this session; visual playback remains unverified. No financial data or loading behavior changed.
