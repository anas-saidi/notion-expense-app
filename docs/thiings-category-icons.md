# Thiings category artwork

First pass completed 1 November 2026 for the existing finance web app.

## Implemented

56 selected images cover all 91 category records from the current catalog, including frozen/archived categories. Shared rendering replaces category emoji in Budget, activity rows, transaction pickers and chips, details, planning/rebalance, savings choices and SVG jar contents. Account emoji and ownership mascots remain separate.

The images are transparent 256px WebP files, 621,084 bytes combined. They are served with the app rather than fetched from Thiings at runtime. Each original source URL is recorded in public/category-icons/attribution.json. The downloaded images were visually inspected on a contact sheet; the mapping distinguishes cases such as Car Expenses versus Personal Saving despite the same original receipt emoji.

Existing Notion emoji metadata and API shapes remain untouched. The image resolver uses normalized category names first and legacy emoji aliases second. Unknown categories get a neutral receipt image. Explicit local or HTTPS image sources are supported by the renderer for a future persistence path.

New category displays a preview that changes with the entered name. This is automatic matching, not a manual image picker. Category edits retain the stored emoji for Notion compatibility. No category was created and no financial record was modified during verification.

## Validation

- TypeScript and production build passed.
- 13 icon mapping/jar tests passed, including distinct matches for categories sharing emoji, punctuation/spacing normalization, actual bundled file existence, unknown fallback and retained jar weighting.
- All 56 files verified at 256 × 256, with alpha transparency.
- Static design detector returned no findings on the shared image component, option picker, category form and category jar.
- Live desktop inspection covered Budget in dark and light appearance, creation-form image matching, and the transaction category popover. The Groceries draft changed its preview, then closed without saving. Picker labels/search and nested Escape dismissal remained available.
- Animated SVG contents use the shared resolver and retained model tests; a populated animated spending jar was not independently visually accepted in this pass. Native Swift and full phone simulator verification were not performed.

Evidence in artifacts/thiings-2026-11-01: budget-dark.png, budget-light.png, budget-preview.png, new-category.png, transaction-picker.png. These screenshots remain local because they contain personal finance data.

## Picker recommendation

Yes: add a searchable, keyboard-accessible gallery to New category and Edit category. Start with the curated set so the product remains fast and visually coherent; keep a larger preview and an explicit Use image action. Store a stable icon identifier rather than infer the choice from a mutable name. Optionally add an import-by-URL flow for another individually chosen Thiings image.

For parity in Notion, persist the choice as the category page icon. Notion supports an external image URL or a file uploaded through its File Upload API. A stable app-hosted image URL can be used after deployment; localhost URLs cannot be used by Notion. Uploading a PNG to Notion avoids depending on a private local server. Do not rely on expiring Notion-hosted URLs as durable identifiers.

The current category API accepts only emoji and the Notion category mapper reads only page.icon.emoji. Implementing this route requires extending read/write validation and mapping to external/file icons, retaining old emoji compatibility, and updating native image rendering before migrating shared Notion icons. The manual picker and migration are not part of this first pass.

No supported public Thiings search API was verified. The site exposes a public catalog used to identify these selected assets; it should not be treated as a guaranteed integration contract. A curated local catalog is sufficient for the initial picker. A larger catalog requires checking licensing and a maintainable source/import process.

Sources:
- [Thiings collection](https://www.thiings.co/things)
- [Thiings usage terms](https://www.thiings.co/terms): personal/non-commercial free use requires visible attribution; appropriate paid licensing is required for commercial use.
- [Notion emoji and icon objects](https://developers.notion.com/reference/emoji-and-icon): external and uploaded image icon support.
- [Notion Update page](https://developers.notion.com/reference/patch-page)
