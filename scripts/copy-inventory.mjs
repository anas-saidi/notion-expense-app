import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Source coverage, not a claim that every rendered state has been tested.
const excluded = /(?:\.test\.|Lab\.|-lab\/|\/ui\/icons\.tsx$)/;
const technicalAttribute = /^(?:className|style|key|id|href|src|type|name|value|role|target|rel|method|inputMode|autoComplete|data-.*|aria-(?:hidden|live|modal|expanded|selected|controls|describedby|labelledby|current|pressed|atomic))$/;
const helpers = new Set([
  'app/manifest.ts', 'app/components/app-utils.ts', 'app/components/category-runway.ts',
  'app/components/month-plan-actions.ts', 'app/components/month-plan-receipt.ts',
  'app/components/work-time.ts', 'app/components/reflect-utils.ts',
]);
const copyAttribute = /^(?:aria-label|ariaLabel|aria-valuetext|placeholder|title|label|deleteLabel|saveButtonLabel|balancedLabel|metaLabel|description)$/;
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if ((file.endsWith('.tsx') || helpers.has(file)) && !excluded.test(file)) files.push(file);
  }
}
walk('app');
const entries = [];
for (const file of files.sort()) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    let text;
    let kind;
    if (ts.isJsxText(node)) { text = node.text.replace(/\s+/g, ' ').trim(); kind = 'visible'; }
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
      let p = node.parent;
      while (p && !ts.isJsxAttribute(p) && !ts.isStatement(p)) p = p.parent;
      if (p && ts.isJsxAttribute(p) && (technicalAttribute.test(p.name.getText(source)) || !copyAttribute.test(p.name.getText(source)))) return;
      for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isVariableDeclaration(ancestor) && /style/i.test(ancestor.name.getText(source))) return;
      }
      text = ts.isTemplateExpression(node) ? node.getText(source).slice(1, -1) : node.text;
      kind = p && ts.isJsxAttribute(p) ? p.name.getText(source) : 'expression';
      // Exclude syntax, URLs, selectors, CSS and programmatic enum values.
      if (text === 'use client' || !/[a-zA-Z]/.test(text) || /^([/.#@]|https?:|var\(|rgba?\(|linear-gradient|translate|repeat\(|minmax\(|clamp\(|[0-9.]+px)/.test(text) || /[{};]/.test(text.replace(/\$\{[^}]+\}/g, '')) || (!/\s/.test(text) && !/^[A-Z][a-z]+$/.test(text))) text = '';
    }
    if (text && /[a-zA-Z]/.test(text)) entries.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, text });
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
  }
  visit(source);
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ files, entries }, null, 2));
else {
  for (const file of files) {
    console.log('\n' + file);
    for (const e of entries.filter(e => e.file === file)) console.log(`${e.line} [${e.kind}] ${e.text}`);
  }
  console.log(`\n${files.length} files; ${entries.length} candidate text items.`);
}
