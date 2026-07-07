/**
 * Entry -> Markdown renderer. Kept separate from extraction so cached
 * structured entries can be re-rendered (or, later, JIT-filtered) without
 * re-parsing source.
 */

const DESC_INLINE_LIMIT = 96;

/** @param {import('../extractors/jsts/index.js').Entry} entry */
export function renderEntry(entry) {
  const out = [];
  const purpose = entry.purpose ? `  — ${entry.purpose}` : '';
  out.push(`## ${entry.path}  (${entry.lines} lines)${purpose}`);

  if (entry.imports.length) {
    out.push(`imports: ${entry.imports.map((i) => i.source).join(', ')}`);
  }
  if (entry.reexports.length) {
    out.push(`re-exports: ${entry.reexports.map((r) => `${r.names} from ${r.from}`).join(', ')}`);
  }
  if (entry.barrel) return out.join('\n');

  const exported = entry.symbols.filter((s) => s.exported);
  const internal = entry.symbols.filter((s) => !s.exported);
  if (exported.length) {
    out.push('exported:');
    for (const sym of exported) out.push(...renderSymbol(sym));
  }
  if (internal.length) {
    out.push('internal:');
    for (const sym of internal) out.push(...renderSymbol(sym));
  }
  return out.join('\n');
}

/** @param {import('../extractors/jsts/index.js').SymbolInfo} sym */
function renderSymbol(sym) {
  let head = sym.name;
  if (sym.kind === 'class') head = `class ${sym.name}${sym.detail}`;
  else if (sym.kind === 'interface') head = `interface ${sym.name}${sym.detail}`;
  else if (sym.kind === 'type') head = `type ${sym.name}${sym.detail}`;
  else if (sym.kind === 'enum') head = `enum ${sym.name}${sym.detail}`;
  else if (sym.params !== null) head = `${sym.name}${sym.params}`;
  else if (sym.detail) head = `${sym.name}${sym.detail}`;

  if (sym.returns) head += ` -> ${sym.returns}`;
  if (sym.isDefault && sym.name !== 'default') head += ' (default)';
  head = `  ${head} @ L${sym.line}`;

  if (!sym.desc) return [head];
  const inline = `${head}    # ${sym.desc}`;
  if (inline.length <= DESC_INLINE_LIMIT) return [inline];
  return [head, `    # ${sym.desc}`];
}
