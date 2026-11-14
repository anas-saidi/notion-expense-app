# Soft-focus cards (reference research, 13 Nov 2026)

Research only. Nothing here is approved direction; `design.md` still governs.

Reference: phone screens from a deck/flashcard app ("Decks", "Private cards", "Mental Models", "Streak freeze", "Feed"). App not identified; closest public candidates are Deck App: Micro Learning and Aha! Cards & AI on the App Store, neither confirmed.

## What the style is called

No single canonical name. Best fit: **soft-focus UI** (also "ethereal" or "dreamy" UI), a branch of **glassmorphism** with **progressive blur**. "Glassmorphism" alone is too narrow: the reference has very little frosted glass; its signature is that edges dissolve.

Techniques that make it:

1. Feathered edges: cards and screens fade to transparent through an alpha mask instead of a border (bottom of the Decks screen, the cushion-shaped deck tiles).
2. Progressive blur: blur radius ramps across a region (top and bottom of the phones).
3. Diffuse ambient shadows: very large, low-opacity, offset-free shadows; the object floats rather than sits.
4. Ambient colour glow: a heavily blurred blob of pastel colour behind content (pink haze behind the grid).
5. Iridescent / holographic 3D art inside cards: the only saturated colour on screen.
6. Off-white canvas, quiet small type, generous space.
7. Soft organic card silhouettes (pillow or scalloped squircles) rather than plain rounded rectangles.

## Examples

| Example | Take from it |
|---|---|
| Apple HIG Materials / Liquid Glass: https://developer.apple.com/design/human-interface-guidelines/materials | Platform rules for translucency and when content stays opaque. |
| Spline, progressive blur gradients: https://blog.spline.design/introducing-progressive-blur-gradients | Clear definition of blur radius as a gradient. |
| Chrome, soft edge content fade: https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/soft-edge-content-fade | The canonical `mask-image` feathering recipe. |
| Opal (screens): https://screensdesign.com/discover/apps/opal-screen-time-control/ | Iridescent 3D gem art as reward objects on calm screens. |
| How We Feel: https://howwefeel.org | Blurred colour fields carry emotion without chrome. |
| mymind: https://mymind.com | Off-white, quiet type, cards that barely have edges. |
| Endel: https://endel.io | Soft generative blurred gradients as a living background. |
| daisyUI trend page, holographic UI: https://trends.daisyui.com/trend/holographic-iridescent-ui/ | Rule: never put body text on iridescent surfaces. |

## Web build

See chat summary; snippets duplicated here.

```css
/* Feathered card edge */
.soft-card {
  -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent);
          mask-image: linear-gradient(to bottom, #000 70%, transparent);
}
/* All-sides feather */
.soft-art {
  mask-image: radial-gradient(closest-side, #000 72%, transparent);
}
/* Diffuse float shadow */
.float { box-shadow: 0 1px 2px rgb(14 15 12 / .03), 0 12px 32px rgb(14 15 12 / .05), 0 40px 80px rgb(14 15 12 / .06); }
/* Cheap ambient glow: gradient, not filter */
.glow { background: radial-gradient(50% 50% at 50% 40%, rgb(255 180 220 / .35), transparent 70%); }
```

Performance: prefer gradients and masks over `filter: blur()` on large boxes; keep `backdrop-filter` to small fixed regions; never blur scrolling content per frame; pre-render blurred art into the WebP asset. Safari has no `prefers-reduced-transparency` as of the sources checked, so the opaque fallback must also be the default under `@supports not (backdrop-filter: blur(1px))`.
