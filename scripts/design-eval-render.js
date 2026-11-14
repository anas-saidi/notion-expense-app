// Rendered pass of the UI consistency eval. Paste into the page (or inject with a
// browser tool) on any screen or open sheet; it returns a JSON report of what the
// browser actually renders. Read-only: it clicks nothing and writes nothing.
// Save several reports into design-eval.render.json and run `npm run design:eval`.
(() => {
  const TYPE = [12, 13, 15, 20];
  const RADIUS = [0, 12, 16, 24];
  const root = document.documentElement;

  // Every colour token, resolved to rgb through a probe element.
  const probe = document.createElement("i");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const tokenNames = new Set();
  const tokenValues = new Set();
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const visit = list => { for (const r of list) { if (r.style) for (const p of r.style) if (p.startsWith("--")) { tokenNames.add(p); tokenValues.add(r.style.getPropertyValue(p).trim()); } if (r.cssRules) visit(r.cssRules); } };
    visit(rules);
  }
  const tokenColors = new Set(["rgba(0, 0, 0, 0)"]);
  const resolve = v => { probe.style.color = ""; probe.style.color = v; return probe.style.color ? getComputedStyle(probe).color : null; };
  for (const name of tokenNames) { if (getComputedStyle(root).getPropertyValue(name).trim()) { const c = resolve(`var(${name})`); if (c) tokenColors.add(c); } }
  for (const v of tokenValues) { const c = resolve(v); if (c) tokenColors.add(c); }
  probe.remove();

  const visible = el => {
    if (el.closest("[aria-hidden='true'], [inert], svg, .mascot, [class*='mascot'], [class*='grain']")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || el.closest(".sr-only, .visually-hidden")) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05;
  };
  const px = v => Math.round(parseFloat(v) * 10) / 10;
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const label = el => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${text}"`;
  };

  // Audit the topmost open sheet when there is one, otherwise the screen.
  const panels = [...document.querySelectorAll(".bottom-sheet-panel, [role=dialog]")].filter(p => p.getBoundingClientRect().height > 0);
  const scope = panels.pop() || document.body;
  const $$ = sel => scope.querySelectorAll(sel);
  const checks = {};
  const add = (id, ok, bad) => { const c = (checks[id] ||= { ok: 0, bad: [] }); if (ok) c.ok++; else c.bad.push(bad); };

  // 1. Browser-default controls: native font (13.33px) or the default grey bevel.
  for (const el of $$("button, input, select, textarea, a")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const native = (s.fontSize === "13.3333px" && (ownText(el) || el.matches("input, select, textarea")) && !/rounded/i.test(s.fontFamily))
      || (s.borderStyle === "outset") || (el.matches("input[type=checkbox], input[type=radio], select") && s.appearance !== "none");
    add("native", !native, native && `${label(el)} renders with browser defaults (${s.fontSize} ${s.fontFamily.split(",")[0]})`);
  }

  // 2. One look per Button tier: every .ui-button of a variant and size renders the same.
  const sig = (s, keys) => keys.map(k => s[k]).join("|");
  const tiers = {};
  for (const el of $$(".ui-button")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const key = `${el.dataset.variant || "primary"}/${el.dataset.size || "regular"}`;
    const look = sig(s, ["fontSize", "fontWeight", "borderTopLeftRadius", "color", "backgroundColor", "borderTopWidth"]) + "|" + Math.round(el.getBoundingClientRect().height);
    ((tiers[key] ||= {})[look] ||= []).push(label(el));
  }
  for (const [key, looks] of Object.entries(tiers)) {
    const ranked = Object.entries(looks).sort((a, b) => b[1].length - a[1].length);
    ranked.forEach(([look, els], i) => els.forEach(e => add("buttonTiers", i === 0, i && `${e} differs from other ${key} buttons (${look})`)));
  }

  // 3. Raw buttons that look like action buttons (filled or outlined, with text) but skip the primitive.
  for (const el of $$("button:not(.ui-button):not(.screen-chip):not(.lg-button):not([role=switch]):not([role=option]):not([role=tab])")) {
    if (!visible(el) || !el.textContent.trim()) continue;
    const s = getComputedStyle(el);
    const filled = s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderTopWidth) > 0;
    const r = el.getBoundingClientRect();
    const rowLike = r.width > 0.6 * (el.parentElement?.getBoundingClientRect().width || 1) && r.height > 52;
    add("rawButtons", !(filled && !rowLike && r.width < 260), `${label(el)} looks like a button but is not <Button> (${s.fontSize}, ${s.backgroundColor})`);
  }

  // 4. Chips: every ScreenChip of a mode and state renders the same.
  const chipLooks = {};
  for (const el of $$(".screen-chip")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const state = el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true" ? "on" : "off";
    const look = sig(s, ["fontSize", "fontWeight", "borderTopLeftRadius", "color", "backgroundColor"]) + "|" + Math.round(el.getBoundingClientRect().height);
    ((chipLooks[state] ||= {})[look] ||= []).push(label(el));
  }
  for (const [state, looks] of Object.entries(chipLooks)) {
    const ranked = Object.entries(looks).sort((a, b) => b[1].length - a[1].length);
    ranked.forEach(([look, els], i) => els.forEach(e => add("chips", i === 0, i && `${e} differs from other ${state} chips (${look})`)));
  }

  // 5. Rendered text: sizes on the type scale, never below 12px, token colours, one family.
  const families = {};
  for (const el of $$("*")) {
    if (!ownText(el) || !visible(el)) continue;
    const s = getComputedStyle(el);
    const size = px(s.fontSize);
    // The shared currency mark is a unit, not text: design.md sizes it at min(0.7em, 12px).
    if (el.classList.contains("currency-mark")) continue;
    const field = el.matches("input, textarea, [contenteditable]") || el.closest("[contenteditable], [role=textbox], label, [class*=input], [class*=field]");
    const onScale = TYPE.includes(size) || size >= 28 || (size === 16 && field);
    add("textSize", onScale, `${label(el)} ${size}px${size < 12 ? " (below 12px)" : ""}`);
    // color-mix() of tokens computes to color(srgb ...); a literal hex computes to rgb().
    add("textColor", tokenColors.has(s.color) || s.color.startsWith("color("), `${label(el)} colour ${s.color} is not a token`);
    const fam = s.fontFamily.split(",")[0].replace(/"/g, "").trim();
    if (!/mono/i.test(s.fontFamily)) (families[fam] ||= []).push(label(el));
  }
  const famRanked = Object.entries(families).sort((a, b) => b[1].length - a[1].length);
  famRanked.forEach(([fam, els], i) => els.forEach(e => add("family", i === 0, i && `${e} uses ${fam}`)));

  // 6. Tap targets: interactive controls at least 44px tall or wide enough to hit (design.md).
  for (const el of $$("button, a[href], [role=button], [role=switch], [role=tab], input:not([type=hidden]), select")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    add("targets", r.height >= 44 || (r.height >= 32 && r.width >= 44), `${label(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  // 7. Radii on visible surfaces (filled or outlined boxes) come from the shape scale or are pills.
  for (const el of $$("*")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const rad = px(s.borderTopLeftRadius);
    if (!rad) continue;
    const boxed = s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderTopWidth) > 0;
    if (!boxed) continue;
    const h = el.getBoundingClientRect().height;
    const pill = rad >= h / 2 - 1 || s.borderTopLeftRadius.endsWith("%");
    // The desktop frame's 32px outer corners are a documented shape exception (design.md, Desktop dashboard composition).
    const frame = rad === 32 && el.classList.contains("app-shell-root");
    add("radius", pill || frame || RADIUS.includes(rad), `${label(el)} radius ${rad}px`);
  }

  // 8. Looks by role, for the cross-screen comparison in design-eval.mjs: the same role
  // should render the same on every screen and sheet.
  const ROLES = {
    "button primary/regular": ".ui-button[data-variant=primary]:not([data-size=compact]), .ui-button:not([data-variant]):not([data-size=compact])",
    "button primary/compact": ".ui-button[data-variant=primary][data-size=compact], .ui-button:not([data-variant])[data-size=compact]",
    "button secondary/regular": ".ui-button[data-variant=secondary]:not([data-size=compact])",
    "button secondary/compact": ".ui-button[data-variant=secondary][data-size=compact]",
    "button quiet": ".ui-button[data-variant=quiet]",
    "button destructive": ".ui-button[data-variant=destructive]",
    "chip off": ".screen-chip:not([aria-pressed=true]):not([aria-selected=true])",
    "chip on": ".screen-chip[aria-pressed=true], .screen-chip[aria-selected=true]",
    "sheet title": ".sheet-header h2, .sheet-header h1",
    "sheet close": ".sheet-close-button",
    "section label": ".section-label:not(.card-header-title)",
    "card header title": ".card-header h2, .card-header h3",
    "card header action": ".card-header-action",
    "switch": "[role=switch]",
  };
  const KEYS = ["fontSize", "fontWeight", "color", "backgroundColor", "borderTopLeftRadius", "borderTopWidth", "letterSpacing", "textTransform"];
  const looks = {};
  for (const [role, sel] of Object.entries(ROLES)) {
    for (const el of $$(sel)) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      const look = KEYS.map(k => `${k}=${s[k]}`).join(" ") + ` h=${Math.round(el.getBoundingClientRect().height)}`;
      ((looks[role] ||= {})[look] ||= []).push(label(el));
    }
  }

  const view = [...$$("[role=dialog] h1, [role=dialog] h2, main h1, h1")].find(visible)?.textContent.trim().slice(0, 40) || document.title;
  const out = { view, width: innerWidth, checks: {}, looks };
  for (const [id, c] of Object.entries(checks)) out.checks[id] = { ok: c.ok, bad: c.bad.length, examples: [...new Set(c.bad)].slice(0, 5) };
  for (const role of Object.keys(looks)) for (const look of Object.keys(looks[role])) { const els = looks[role][look]; looks[role][look] = { n: els.length, eg: els.slice(0, 2) }; }
  return out;
})();
