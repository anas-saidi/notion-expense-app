// Tour for the rendered eval: opens each screen and sheet, audits it with
// design-eval-render.js and returns { width, reports }. Writes are blocked while it runs.
// In dev, both files are copied to public/ for the run and removed afterwards.
(async () => {
  const realFetch = window.fetch;
  window.fetch = (u, o = {}) => (o.method && o.method !== "GET" ? Promise.reject(new Error("writes blocked during design eval")) : realFetch(u, o));
  const src = await (await realFetch("/__design-eval-render.js", { cache: "no-store" })).text();
  const audit = () => (0, eval)(src);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const find = l => [...document.querySelectorAll("button, a")].find(b => (b.getAttribute("aria-label") || b.textContent.trim()).startsWith(l));
  const click = l => { const b = find(l); if (!b) throw new Error(`no control "${l}"`); b.click(); };
  const dialogs = () => [...document.querySelectorAll(".bottom-sheet-panel, [role=dialog]")].filter(d => d.getBoundingClientRect().height > 0);
  const esc = async () => {
    for (let i = 0; i < 3 && dialogs().length; i++) {
      const top = dialogs().pop();
      const close = top.querySelector(".sheet-close-button, button[aria-label^='Close'], button[aria-label^='Back']");
      if (close) close.click(); else if (find("Close")) click("Close"); else (document.activeElement || document).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await wait(700);
    }
  };
  const reports = [];
  const visit = async (view, open, close = esc) => {
    try { await open(); await wait(1800); reports.push({ ...audit(), view }); }
    catch (e) { reports.push({ view, error: String(e.message || e) }); }
    await close();
  };
  const stay = async () => {};
  const home = async () => { click("Home"); await wait(800); };
  const firstRow = sel => () => { const el = document.querySelector(sel); if (!el) throw new Error(`no ${sel}`); el.click(); };

  await home();
  await visit("Home", stay, stay);
  await visit("Settings", () => click("Settings"));
  await visit("Add transaction", () => click("Add transaction"));
  await visit("Bills", () => click("All bills"));
  await visit("Activity", () => click("View all transactions"));
  await home();
  await visit("Contributions", () => click("Open monthly contributions"));
  await visit("Plan receipt", () => click("View November's plan receipt"));
  await visit("Budget", () => click("Budget"), stay);
  await visit("Category detail", firstRow(".budget-row, .category-jar-row, [data-category-id]"));
  await visit("Rebalance", () => click("Rebalance"));
  await visit("Reflect", () => click("Reflect"), stay);
  await home();
  window.fetch = realFetch;

  // Aggregate into one run for design-eval.render.json (one run per width).
  const ok = reports.filter(r => !r.error);
  const checks = {}, roles = {};
  for (const r of ok) {
    for (const [k, c] of Object.entries(r.checks)) {
      const a = (checks[k] ||= { ok: 0, bad: 0, examples: [] });
      a.ok += c.ok; a.bad += c.bad;
      for (const e of c.examples) if (a.examples.length < 6) a.examples.push(`${r.view}: ${e}`);
    }
    for (const [role, ls] of Object.entries(r.looks)) for (const [look, v] of Object.entries(ls)) {
      const a = ((roles[role] ||= {})[look] ||= { n: 0, views: [], eg: v.eg[0] });
      a.n += v.n; if (!a.views.includes(r.view)) a.views.push(r.view);
    }
  }
  return { width: innerWidth, views: ok.map(r => r.view), failed: reports.filter(r => r.error), checks, roles };
})();
