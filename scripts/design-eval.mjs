#!/usr/bin/env node
// UI consistency eval: scores the code against design.md.
// Each rule counts compliant uses and violations, scores 0 to 100, and the
// weighted mean is the overall score. Run: npm run design:eval [-- --json] [-- --verbose]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = new Set(process.argv.slice(2));

// ---------- files ----------
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = p => path.relative(ROOT, p);
const isLab = f => /(^|\/)[a-z]+-lab\//.test(f) || /Lab\.tsx$/.test(f);
const isPrimitive = f => f.startsWith("app/components/ui/");
// Decorative art (mascots, grain light) has its own motion and colour rules in design.md.
const isArt = f => /app\/components\/(mascot|grain)\//.test(f);

const all = walk(path.join(ROOT, "app")).map(rel).filter(f => !isLab(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
const tsx = all.filter(f => f.endsWith(".tsx"));
const css = all.filter(f => f.endsWith(".css"));
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

// Opening JSX tag starting at i ("<"): returns end index, brace-depth aware.
function tagEnd(src, i) {
  let depth = 0, q = null;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === q && src[j - 1] !== "\\") q = null; continue; }
    if (depth > 0 && (c === '"' || c === "'" || c === "`")) { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return j;
  }
  return -1;
}

// ---------- rules ----------
const rules = [];
function rule(id, title, weight, fn) { rules.push({ id, title, weight, fn }); }

const STRUCTURAL = /(row|option|close|tab|day|jar|toggle|picker|swipe|nav|fact|entry|amount|camera|remove|switch|action|gap|freeze|ask-more|signal|person|join|tag|suggestion|tile|key)/;

rule("button", "Buttons use the shared Button", 3, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    ok += (src.match(/<Button[\s>]/g) || []).length;
    if (isPrimitive(f) || isArt(f)) continue;
    const re = /<button\b/g; let m;
    while ((m = re.exec(src))) {
      const end = tagEnd(src, m.index); if (end < 0) continue;
      const open = src.slice(m.index, end);
      const close = src.indexOf("</button>", end);
      const inner = close > 0 ? src.slice(end + 1, close) : "";
      const text = inner.replace(/<[^>]*>/g, "").replace(/\{[^{}]*\}/g, s => (/^\{\s*</.test(s) ? "" : " x ")).trim();
      const cls = (open.match(/className=(?:"([^"]*)"|\{`([^`]*)`)/) || []).slice(1).find(Boolean) || "";
      const styled = /\sstyle=\{/.test(open);
      // Rows, options, day cells and icon buttons are structural; a labelled control with its own name is too.
      const structural = STRUCTURAL.test(cls) || /aria-label=/.test(open) && !/\sstyle=\{/.test(open);
      if (styled || !structural) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: styled ? "raw <button> styled inline" : `raw <button class="${cls || "none"}">` });
      else ok++;
    }
  }
  return { ok, bad };
});

rule("chip", "Chips use ScreenChip", 2, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    ok += (src.match(/<ScreenChip[\s>]/g) || []).length;
    if (isPrimitive(f)) continue;
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`)/g; let m;
    while ((m = re.exec(src))) {
      // In template classNames keep only the string literals inside ${...}, not variable names.
      const cls = m[1] || m[2].replace(/\$\{([^}]*)\}/g, (_, e) => (e.match(/["'][^"']*["']/g) || []).join(" "));
      for (const c of cls.split(/[\s"'${}?:]+/).filter(Boolean)) {
        if (c.split("-").some(seg => /^(chip|chips|pill|pills)$/.test(seg)) && !/^screen-chip/.test(c) && !/-(rail|row|bar|list|group)$/.test(c)) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `bespoke chip class "${c}"` });
      }
    }
  }
  return { ok, bad };
});

rule("native", "No native checkbox, radio or select", 2, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    ok += (src.match(/<Switch[\s>]/g) || []).length;
    if (isPrimitive(f)) continue;
    const re = /type=["'](checkbox|radio)["']|<select\b/g; let m;
    while ((m = re.exec(src))) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `native ${m[1] || "select"}` });
  }
  return { ok, bad };
});

rule("saving", "Writes block with the saving cover", 3, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    ok += (src.match(/<SavingCover[\s>]/g) || []).length;
    if (isPrimitive(f)) continue;
    const re = /set(Saving|Busy|Submitting|Deleting)\(true\)/g; let m;
    while ((m = re.exec(src))) {
      // A Gemini ask is not a write, and a busy flag handed up through onBusyChange is covered by the parent's SavingCover.
      const around = src.slice(Math.max(0, m.index - 400), m.index + 600);
      if (/\/api\/ai/.test(around) || /onBusyChange\(true\)/.test(around)) { ok++; continue; }
      bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `manual ${m[0]} instead of useBlockingSave` });
    }
    if (/useBlockingSave\(/.test(src) && !/<SavingCover[\s>]/.test(src)) bad.push({ at: f, why: "useBlockingSave without a <SavingCover>" });
  }
  return { ok, bad };
});

rule("messages", "Toasts, banners and empty states use the primitives", 2, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    ok += (src.match(/<(Banner|EmptyState|Skeleton\w*)[\s>]|showToast\(/g) || []).length;
    if (isPrimitive(f)) continue;
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`)/g; let m;
    while ((m = re.exec(src))) {
      for (const c of (m[1] || m[2]).split(/\s+/)) {
        if (/(toast|snackbar|(^|-)empty($|-)|banner|skeleton|shimmer)/.test(c) && !/^(ui|app)-(toast|empty|banner)/.test(c)) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `bespoke message class "${c}"` });
      }
    }
    const a = /\b(window\.)?(alert|confirm)\(/g;
    while ((m = a.exec(src))) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `browser ${m[2]}()` });
  }
  return { ok, bad };
});

// ---------- style declarations (CSS files plus inline TSX style objects) ----------
const STYLE_KEYS = "fontSize|fontFamily|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingInline|paddingBlock|margin|marginTop|marginBottom|marginLeft|marginRight|marginInline|marginBlock|gap|rowGap|columnGap|borderRadius|color|background|backgroundColor|borderColor|transition";
const kebab = s => s.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
const decls = [];
for (const f of css) {
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  const re = /(^|[;{\s])(-?-?[a-z-]+)\s*:\s*([^;{}]+)/g; let m;
  while ((m = re.exec(src))) {
    if (/^\s*[a-z-]+\s*$/.test(m[3]) && /[{]/.test(src.slice(m.index + m[0].length, m.index + m[0].length + 2))) continue;
    const open = src.lastIndexOf("{", m.index + m[1].length);
    const before = Math.max(src.lastIndexOf("}", open - 1), src.lastIndexOf("{", open - 1), src.lastIndexOf(";", open - 1));
    const selector = src.slice(before + 1, open).trim();
    decls.push({ f, line: lineOf(src, m.index + m[1].length), prop: m[2], value: m[3].trim(), inline: false, selector });
  }
}
for (const f of tsx) {
  const src = read(f);
  const re = new RegExp(`\\b(${STYLE_KEYS})\\s*:\\s*("[^"\\n]*"|'[^'\\n]*'|-?\\d+(?:\\.\\d+)?)(?=\\s*[,}\\n])`, "g"); let m;
  while ((m = re.exec(src))) {
    let v = m[2].replace(/^["']|["']$/g, "");
    if (/^-?\d+(\.\d+)?$/.test(v) && !/^color|^background|^transition/.test(m[1])) v = `${v}px`;
    decls.push({ f, line: lineOf(src, m.index), prop: kebab(m[1]), value: v, inline: true });
  }
}
const at = d => `${d.f}:${d.line}`;
// Exceptions design.md documents explicitly. Keep this list short and cite the section.
const EXCEPTIONS = [
  { rule: "type", file: /(finance-ai|globals)\.css$/, selector: /typed|reflect-ask-sentence/, value: /\b17px\b/, why: "Type it composer and Gemini assistance: written lines are 17px" },
  { rule: "type", file: /\.css$/, selector: /\b(input|textarea|select)\b|field|choice/, value: /^16px/, why: "Typography: text inputs are 16px on phones so iOS does not zoom" },
  { rule: "radius", file: /desktop-dashboard\.css$/, selector: /app-shell-root/, value: /\b32px\b/, why: "Desktop dashboard composition: 32px outer corners are a documented shape exception" },
  { rule: "radius", file: /grain-glow\.css$/, value: /\b28px\b/, why: "Light: content sheet has rounded 28px top corners" },
  { rule: "space", file: /grain-glow\.css$/, value: /\b96px\b/, why: "Light: the room fades out 96px below the hero" },
  { rule: "color", file: /liquid-glass\.css$/, value: /inset/, why: "Liquid glass controls: keep Glisse's specular rim" },
  { rule: "type", file: /CategoryJarRow\.tsx$/, value: /^10px$/, why: "Typography: a spent / held ratio ends with a 10px currency mark" },
];
const excepted = (id, d) => EXCEPTIONS.some(e => e.rule === id && e.file.test(d.f) && (!e.selector || e.selector.test(d.selector || "")) && e.value.test(d.value));
const pxValues = v => [...v.replace(/var\([^)]*\)/g, "").matchAll(/(-?\d*\.?\d+)px/g)].map(x => Math.abs(parseFloat(x[1])));

function declRule(id, title, weight, match, check) {
  rule(id, title, weight, () => {
    let ok = 0; const bad = [];
    for (const d of decls) {
      if (d.prop.startsWith("--") || !match(d)) continue;
      if (excepted(id, d)) { ok++; continue; }
      const why = check(d);
      if (why) bad.push({ at: at(d), why: `${d.prop}: ${d.value.slice(0, 60)}${d.inline ? " (inline)" : ""}${why === true ? "" : ` (${why})`}` });
      else ok++;
    }
    return { ok, bad };
  });
}

const COLOR_PROPS = /^(color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline|outline-color|fill|stroke|box-shadow|caret-color|text-decoration-color)$/;
declRule("color", "Colours come from tokens", 2, d => COLOR_PROPS.test(d.prop) && !isArt(d.f), d => {
  // Token-derived mixes (color-mix of var() and transparent) are fine; literals are not.
  const stripped = d.value.replace(/var\((--[\w-]+)(,[^()]*(\([^()]*\))?[^()]*)?\)/g, "").replace(/color-mix\(in \w+,?/g, "(");
  return /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch)\(|\b(white|black|red|blue|green|gray|grey)\b/i.test(stripped) ? "literal colour" : false;
});

const TYPE = new Set([12, 13, 15, 20]);
declRule("type", "Font sizes on the type scale (12, 13, 15, 20)", 2, d => d.prop === "font-size", d => {
  if (/var\(|clamp\(|inherit|em\b|%|calc\(/.test(d.value) && !/px/.test(d.value.replace(/var\([^)]*\)|clamp\([^)]*\)|calc\([^)]*\)/g, ""))) return false;
  const px = pxValues(d.value);
  if (!px.length) return false;
  const off = px.find(n => !TYPE.has(n) && n < 28); // 28px and up is a financial display size
  return off === undefined ? false : off < 12 ? `${off}px is below the 12px floor` : `${off}px is off scale`;
});

declRule("family", "One type family (var(--font-*))", 1, d => d.prop === "font-family" || d.prop === "font", d => {
  if (d.prop === "font" && !/[a-z]/i.test(d.value.replace(/\d+px|\d+(\.\d+)?|\/|bold|normal|italic|inherit|var\([^)]*\)/g, "").trim())) return false;
  // Monospace is sanctioned for the Type it margin and the saved-plan receipt (design.md).
  return /var\(--(font-|typed-mono|receipt)|inherit|ui-rounded|ui-monospace|monospace/.test(d.value) ? false : "bespoke family";
});

const SPACE = new Set([0, 1, 2, 4, 8, 12, 16, 24, 32, 48]);
declRule("space", "Spacing on the 4-point scale", 1, d => /^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(d.prop), d => {
  const off = pxValues(d.value).find(n => !SPACE.has(n));
  return off === undefined ? false : `${off}px`;
});

const RADIUS = new Set([0, 12, 16, 24, 999, 9999, 100, 50]);
declRule("radius", "Radii from the shape scale (12, 16, 24, pill)", 1, d => d.prop.startsWith("border") && d.prop.endsWith("radius"), d => {
  const off = pxValues(d.value).find(n => !RADIUS.has(n));
  return off === undefined ? false : `${off}px`;
});

const DUR = new Set([0, 120, 200, 320]);
declRule("motion", "Motion: 120/200/320ms, named properties, no ease-in", 1, d => /^(transition|animation)(-duration)?$/.test(d.prop), d => {
  if (/\ball\b/.test(d.value)) return "transition: all";
  if (/\bease-in\b(?!-out)/.test(d.value)) return "ease-in";
  if (isArt(d.f) || /^animation/.test(d.prop)) return false;
  const ms = [...d.value.replace(/var\([^)]*\)/g, "").matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map(x => Math.round(parseFloat(x[1]) * (x[2] === "s" ? 1000 : 1)));
  const off = ms.find(n => !DUR.has(n) && n > 60); // short delays are fine
  return off === undefined ? false : `${off}ms`;
});

rule("icons", "Lucide icons at 16, 20 or 24", 1, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    const names = new Set();
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](lucide-react|\.\/ui\/icons|\.\/icons|\.\.\/ui\/icons)["']/g)) m[1].split(",").forEach(n => names.add(n.trim().split(/\s+as\s+/).pop()));
    if (!names.size) continue;
    for (const m of src.matchAll(/<([A-Z]\w*)\b[^>]*?\bsize=\{(\d+)\}/g)) {
      if (!names.has(m[1])) continue;
      if ([16, 20, 24].includes(+m[2])) ok++;
      else bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `<${m[1]} size={${m[2]}}>` });
    }
  }
  return { ok, bad };
});

rule("copy", "Message copy: no !, Oops, successfully, ellipsis or --", 1, () => {
  let ok = 0; const bad = [];
  for (const f of tsx) {
    const src = read(f);
    for (const m of src.matchAll(/(showToast\(|<Banner[^>]*>|<EmptyState[^>]*?(title|text)=)\s*\{?\s*["'`]([^"'`]+)["'`]/g)) {
      const s = m[3];
      const why = /!$|!\s/.test(s) ? "exclamation" : /\boops\b/i.test(s) ? "Oops" : /successfully/i.test(s) ? "successfully" : /(\.\.\.|…)$/.test(s) ? "ellipsis" : /--/.test(s) ? "double hyphen" : null;
      if (why) bad.push({ at: `${f}:${lineOf(src, m.index)}`, why: `"${s.slice(0, 50)}" (${why})` }); else ok++;
    }
  }
  return { ok, bad };
});

// ---------- score ----------
const results = rules.map(r => {
  const { ok, bad } = r.fn();
  const total = ok + bad.length;
  const score = total ? Math.round((100 * ok) / total) : 100;
  return { id: r.id, title: r.title, weight: r.weight, ok, violations: bad.length, score, bad };
});
const weighted = list => { const w = list.reduce((s, r) => s + r.weight, 0); return w ? Math.round(list.reduce((s, r) => s + r.score * r.weight, 0) / w) : null; };
const gradeOf = n => (n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 60 ? "D" : "F");
const staticScore = weighted(results);

// ---------- rendered pass (design-eval.render.json, captured with scripts/design-eval-render-tour.js) ----------
const RENDER_FILE = path.join(ROOT, "design-eval.render.json");
const RENDER_RULES = {
  native: ["No browser-default controls on screen", 2],
  rawButtons: ["Button-looking controls use <Button>", 2],
  buttonTiers: ["Each Button tier renders one way per screen", 2],
  chips: ["Each chip state renders one way per screen", 2],
  roles: ["Same role, same look on every screen", 3],
  textSize: ["Rendered text on the type scale", 1],
  textColor: ["Rendered text in token colours", 1],
  family: ["One rendered type family", 1],
  targets: ["Tap targets 44px", 1],
  radius: ["Rendered radii on the shape scale", 1],
};
let rendered = [];
let renderMeta = null;
if (fs.existsSync(RENDER_FILE)) {
  const data = JSON.parse(fs.readFileSync(RENDER_FILE, "utf8"));
  renderMeta = { captured: data.captured, widths: data.runs.map(r => r.width), views: data.runs[0]?.views.length ?? 0 };
  const sums = {};
  for (const run of data.runs) {
    for (const [id, c] of Object.entries(run.checks)) {
      const a = (sums[id] ||= { ok: 0, bad: [] });
      a.ok += c.ok;
      a.bad.push(...Array.from({ length: c.bad }, (_, i) => ({ at: `${run.width}px`, why: c.examples[i] || c.examples[c.examples.length - 1] || "" })));
    }
    // Cross-screen: within one width, the most common look of a role is the reference; every other look is off.
    const a = (sums.roles ||= { ok: 0, bad: [] });
    for (const [role, looks] of Object.entries(run.roles)) {
      const ranked = Object.entries(looks).sort((x, y) => y[1].n - x[1].n);
      ranked.forEach(([look, v], i) => {
        if (i === 0) a.ok += v.n;
        else for (let k = 0; k < v.n; k++) a.bad.push({ at: `${run.width}px ${v.views.join(", ")}`, why: `${role} renders "${look}", elsewhere "${ranked[0][0]}" (${v.eg})` });
      });
    }
  }
  rendered = Object.entries(RENDER_RULES).filter(([id]) => sums[id]).map(([id, [title, weight]]) => {
    const { ok, bad } = sums[id];
    const total = ok + bad.length;
    return { id: `render.${id}`, title, weight, ok, violations: bad.length, score: total ? Math.round((100 * ok) / total) : 100, bad };
  });
}
const renderScore = weighted(rendered);
const overall = renderScore == null ? staticScore : Math.round((staticScore + renderScore) / 2);
const grade = gradeOf(overall);

const printRules = (heading, list) => {
  console.log(`\n${heading}`);
  for (const r of list) console.log(`${String(r.score).padStart(4)}  ${r.title.padEnd(56)} ${String(r.violations).padStart(4)} off, ${r.ok} ok`);
};
if (args.has("--json")) {
  const strip = list => list.map(({ bad, ...r }) => ({ ...r, examples: [...new Map(bad.map(b => [b.why, b])).values()].slice(0, 50) }));
  console.log(JSON.stringify({ overall, grade, static: staticScore, rendered: renderScore, renderMeta, rules: strip(results), renderRules: strip(rendered) }, null, 2));
} else {
  console.log(`\nUI consistency: ${overall}/100 (${grade})`);
  printRules(`Code: ${staticScore}/100`, results);
  if (renderScore != null) printRules(`Rendered: ${renderScore}/100 (${renderMeta.views} views at ${renderMeta.widths.join(" and ")}px, captured ${renderMeta.captured})`, rendered);
  else console.log("\nRendered: not captured (run scripts/design-eval-render-tour.js in the dev app)");
  const n = args.has("--verbose") ? Infinity : 5;
  for (const r of [...results, ...rendered].filter(r => r.bad.length)) {
    const unique = [...new Map(r.bad.map(b => [b.at + b.why, b])).values()];
    console.log(`\n${r.title}`);
    unique.slice(0, n).forEach(b => console.log(`  ${b.at}  ${b.why}`));
    if (unique.length > n) console.log(`  … ${unique.length - n} more (use --verbose)`);
  }
}

// Ratchet: fail when any rule gains violations over the committed baseline.
const BASE = path.join(ROOT, "design-eval.baseline.json");
if (args.has("--update-baseline")) {
  fs.writeFileSync(BASE, JSON.stringify(Object.fromEntries([...results, ...rendered].map(r => [r.id, r.violations])), null, 2) + "\n");
  console.log(`\nBaseline written to ${rel(BASE)}`);
} else if (args.has("--check") && fs.existsSync(BASE)) {
  const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
  const worse = [...results, ...rendered].filter(r => r.violations > (base[r.id] ?? 0));
  if (worse.length) {
    console.error(`\nNew design violations: ${worse.map(r => `${r.id} ${base[r.id] ?? 0} → ${r.violations}`).join(", ")}`);
    process.exit(1);
  }
}
