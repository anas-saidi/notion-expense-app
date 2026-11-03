# Mascot and chart motion

Target: Reflect Spending → Activity, mascot tap, and Joint identity across the phone picker and hero. Preserve accurate totals, partner colors, glass rendering and existing physics.

Reference: https://bloub.vercel.app/ and its MIT source https://github.com/jeremy-prt/bloub. Joint adapts Pebble's small harmonic asymmetry into a rounded heart. License remains in the mascot directory.

| Rule | Finding and repair | Evidence / acceptance |
| --- | --- | --- |
| IC-02 | Joint's jar used a midpoint while its picker used a separate heart. Use one heart-pebble profile and one face. | Engine test confirms matching picker/jar body and two eyes. |
| IC-07 | Standalone mascot taps only produced haptics. Add a 280ms press and settle, cancelling an unfinished press on repeated activation. | Source checked; native button and accessible label preserved. Rendered feedback remains unverified. |
| IC-10 | Keep exact chart legend totals and data; animate geometry only. | No data transformations changed. |
| IC-13 | Recharts used its default duration. Set both charts to 360ms, no delay, ease-out. Use 220ms Reflect replacement opacity and 420ms interrupted shape morph. | App suite: 629 passed, 5 skipped; build passed. Reduced-motion branches and visibility pause retained by source inspection. Live reduced-motion playback unverified. |
| IC-12 | Keep existing phone and desktop layout, target sizes, and chart dimensions. | Source checked. Native Safari has no window; Brave preview exposes browser chrome without page content and its capture is blank grey. Responsive visual acceptance remains unverified. |

No financial records intentionally changed for UI verification. Test fixtures use simulated records. Existing tests verify custom/Matter coin containment with the changed Joint boundary and interrupted morph continuity. No new runtime dependency or animation loop.

## Follow-up: original Pebble and stable hover

User rejected the heart silhouette and reported hover jitter in the phone scope picker. This supersedes the heart geometry above. Joint now uses the original Bloub Pebble harmonics and normalization exactly, with the existing blue/pink material. Picker and jars share the same profile.

IC-13 / IC-07: source inspection found the app-wide `button:not(:disabled):hover` lift outranking the phone picker position transform. The button moves under the pointer and can repeatedly enter/leave hover. The picker now explicitly preserves `translateX(var(--scope-slot, 0px))` on hover and active, with selector precedence above the generic lift. Selection remains the only source of stack movement.

Validation: 57 mascot tests pass, including exact source-profile comparison, picker/jar consistency, interrupted morphs and custom/Matter containment; production build passes. Native Safari opens the preview but returns a blank page with no content AX, while the local fixture serves HTML successfully. Live hover playback and responsive appearance remain unverified. No financial writes performed for verification.

## Follow-up: morph when changing scope

The hero wrapper keyed HeroJar by scope, remounting its engine and bypassing the existing radial morph. Remove that key so Home, Budget, Reflect, planning and allocation heroes retain their engine across scope changes. Remembered entrance state now tracks its context: changing scope cancels an unfinished initial reveal and uses the destination scope’s current contents immediately, while screen openings retain their stored-state behavior. Reduced Motion remains immediate.

Validation: 61 mascot tests pass, including rapid interrupted changes for liquid and spending heroes and direct reduced-motion changes. Production build passes. Native Safari’s actual localhost:3000 app now renders successfully: Home Joint → Anas retained hero placement and showed destination contents and amounts; Reflect spending also handled rapid keyboard switches Anas → Joint → Salma, showing Salma’s current contents and total. Restored Joint Home afterwards. Intermediate animation timing and phone rendering are not directly measured in this pass. No financial records changed.
