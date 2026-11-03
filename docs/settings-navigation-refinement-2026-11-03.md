# Settings, mode selection and summary details

Product: household budgeting for two people.
Character: warm, exact, unhurried.
World: glass money jars on quiet, neutral surfaces.
Moments: the existing spending jar and a brief mode-selection rotation.
Signature: each partner’s mascot and the Joint heart, consistently identifying the selected money context.

The supplied screenshots show a light refinement need: two Settings routes to account checks, unused Work & income configuration, an oversized artwork credit section, a detached right-aligned Reflect switch, and several summary facts without detail actions. The user’s six comments authorize this focused direction. Keep the palette, typography, 250px heroes and product artwork.

- Settings now has one Accounts entry; each account retains Check balance. Home discrepancy links still open the relevant check directly. Work & income configuration, conversions and its local feature code are removed.
- Artwork is no longer a Settings section. The free-license credit remains as a small footer link after sync, following the [Thiings terms](https://www.thiings.co/terms).
- The Reflect switch is leading-aligned beneath the mode picker, with 44px controls and no extra hero row.
- On phones, the enclosing scope pill is 136×48px. Its three targets remain 44px wide. Artwork gathers closer; the active mascot moves forward while the other two move behind it. Transform/opacity transitions last 320ms, interrupt without remounting, and stop under reduced motion. Arrow keys and Home/End use one roving tab stop. Desktop names remain visible.
- Summary actions receive a quiet underline. Home and Budget retain their account, contribution, planning and Rebalance destinations. Reflect’s multiple over-budget categories open a focused list linking to existing category transactions. Planner contribution dues open Contributions. Bill totals clear the day/search selection and select the matching Due or Overdue list.
- Reflect’s top-three concentration remains plain: it refers to the first three rows in the descending category list immediately below. The within-budget state is also explained by that list; Activity’s amounts are already in the chart legend. Planner comparisons already appear in its rows. No empty duplicate detail views were added for these facts.

Pattern evidence: [stacked lists](https://mobbin.com/glossary/stacked-list), [segmented controls](https://mobbin.com/glossary/segmented-control), and [modal bottom sheets](https://mobbin.com/glossary/bottom-sheet), interpreted within the existing product system.

Verification: TypeScript, 628 remaining regression tests and production build passed. Nine Work & income tests were removed with the feature. An isolated fixture rendered the actual components at 498×827 and 1200×827 with synthetic data. Inspection covered Reflect alignment, scope switching and arrow-key selection, summary → over-budget list → category transactions, Settings in light/dark states, and Accounts → account details with Check balance retained. Reduced motion was reviewed in CSS; an OS preference was not changed. No financial records were modified. Mobile Reflect was visually inspected; native browser windows changed during the final Settings screenshot attempt, so full-image acceptance of every Settings/theme state is not claimed.

Review guidance: [Unslop by Damir Sokolovsky](https://heydamir.design/unslop), CC BY 4.0, and Impeccable. The Impeccable context launcher lacked execute permission earlier in the session; existing project context was read directly.
