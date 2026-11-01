# Month receipt exploration

1 November 2026. Design exploration only; the receipt feature remains on the roadmap. The illustrative comparison does not connect to financial records or save real signatures.

## Reference evidence

- [Supplied Pinterest pin](https://www.pinterest.com/pin/1110770695648261900/) identifies **Run Receipt Scroll Animation**, posted by 60fps. Its description points to paper feeding downward and being dragged/scrolled through an anchored opening.
- [Original 60fps reference](https://60fps.design/shots/run-receipt-scroll-animation) describes a continuous reveal through a terminal slot, followed by scrolling within that mask. The captured page visually shows a narrow thermal-paper strip, compact monospace rows, a fixed dark slot and restrained paper depth.
- [Related signature reference](https://60fps.design/shots/run-receipt-signature-interaction) describes a separate drawing surface that dismisses after confirmation and places the signature on the receipt. Its captured still shows the signature near the paper's lower edge.

Pinterest MCP was not exposed in the session or local MCP registrations; the connector directory did not return a Pinterest connector. Fallback: existing Pinterest browser session, public text reader and purpose-built page capture of the linked source. Source screenshots and descriptions were inspected. Exact video timing, drag resistance, easing and audio were not measured.

## Recommendation: Printed keepsake

Give the close of a month one short physical moment. When the final Settle line is marked sent, reveal a narrow receipt through a shallow slot. Once visible, retain the receipt and its two signing actions. Reopening through Reflect shows the completed paper immediately.

The reference contributes an interaction model; its running metrics, branding and action vocabulary do not belong in this finance app. The product retains its own typography outside the receipt, ink controls, household scope and existing settlement rules. The receipt is an intentional monospace/paper exception. It stays text-only.

Suggested starting treatment, to validate in implementation:

- Narrow paper, approximately 300–340px where the viewport permits, with responsive gutters. A subtle lower paper edge, one contact shadow and a thin slot supply sufficient depth.
- Approximate 900–1,100ms initial reveal, available immediately with a short fade under Reduce Motion. This timing is our proposal, not a measurement from the source.
- Keep the content geometry stable while revealing it; move paper through a clipped region. Do not sequence every amount as a separate animation. A user can skip the reveal or continue reviewing without waiting for decorative motion.
- Name the month, list the top four spending categories and one Other categories line, then the total, plan comparison, contributions, repayments and two signatures. Use stable numerals and keep exact currency semantics accessible. Expand financial details when long names or large text prevent a one-screen composition.
- Both signature actions remain visible. Offer a dedicated drawing surface and a tap-to-sign alternative; bind saved confirmation to the authenticated partner and receipt revision. A prototype that displays both example names is not the real identity/permission model.
- Tie the receipt to a settled financial snapshot. Subsequent edits require a visible amendment/revision policy; do not silently retain signatures over changed amounts.
- Keep completion calm even when the month is over plan. State the signed difference in text without framing household spending as a competition.

## Alternative: Shared ledger

A broader paper sheet puts spending and the plan comparison on one side, contributions and signatures on the other. On a phone the two groups stack. It offers a quieter review experience and more room for large text, but the completion moment is less distinctive.

Recommended split: Printed keepsake for the first close; a quiet already-printed receipt for later review. Shared ledger is a comparison direction, not an accepted replacement.

## Interaction sequence

1. Final settlement confirmation completes the existing plan workflow.
2. Receipt becomes available with its settled month and snapshot.
3. First display prints once; Reduce Motion uses the short fade.
4. Each partner acknowledges/signs their own line, independently.
5. The receipt remains available under View receipt in Reflect.

Persistent signature format and image export remain open roadmap decisions. Export should remove surrounding interface controls and retain month, provenance, amounts and signature state. This exploration does not establish licensing rights for illustrations or a legal e-signature workflow.

## Exploration validation

Two comparison directions were rendered at desktop and narrow widths. The mock uses clearly labeled illustrative amounts that add up: top four plus Other equals 24,860, against a 25,000 plan, leaving 140 under plan. Native browser checks confirmed example signing changes the displayed names/status, print replay enters a temporary busy state, and the variant control switches to Shared ledger. The preview is theme-aware and includes a reduced-motion branch; an operating-system Reduce Motion session was not exercised.

No app feature, route, Notion record or roadmap commitment was changed.
