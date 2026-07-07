/**
 * React refiner: for components the PROPS are the interface, not `(props)`.
 * Sources, in order of authority: TS props type on the first param,
 * destructured param keys, a Component.propTypes assignment. If none of
 * these exist the raw params stay — never fabricate.
 */

export function refineReact(entry, ctx) {
  const isReactFile =
    /\.(jsx|tsx)$/.test(entry.path) || entry.imports.some((i) => i.source === 'react' || i.source.startsWith('react/'));
  if (!isReactFile) return;

  const propTypesKeys = collectPropTypes(ctx.tree.rootNode);

  for (const sym of entry.symbols) {
    if (sym.kind !== 'function' || !/^[A-Z]/.test(sym.name) || !sym._node) continue;
    sym.kind = 'component';
    const props = propsInterface(sym._node) ?? propTypesKeys.get(sym.name);
    if (props) sym.params = `(${props})`;
  }
}

/** Props from the first parameter: TS type annotation or destructuring pattern. */
function propsInterface(fnNode) {
  const params = fnNode.childForFieldName('parameters') ?? fnNode.childForFieldName('parameter');
  if (!params) return null;
  const first = params.type === 'identifier' ? params : params.namedChildren.find((c) => c.type !== 'comment');
  if (!first) return null;

  // TS grammar: required_parameter { pattern, type }
  if (first.type === 'required_parameter' || first.type === 'optional_parameter') {
    const type = first.childForFieldName('type');
    if (type) {
      const t = type.text.replace(/^:\s*/, '').replace(/\s+/g, ' ');
      // Inline object type -> show it; named type -> keep the reference (its
      // interface declaration is listed in the same entry when local).
      return `props: ${t}`;
    }
    const pattern = first.childForFieldName('pattern');
    if (pattern && pattern.type === 'object_pattern') return pattern.text.replace(/\s+/g, ' ');
    return null;
  }
  if (first.type === 'object_pattern') return first.text.replace(/\s+/g, ' ');
  return null;
}

/** Component.propTypes = { … } assignments anywhere in the file -> name -> "{keys}". */
function collectPropTypes(root) {
  const found = new Map();
  for (const stmt of root.namedChildren) {
    if (stmt.type !== 'expression_statement') continue;
    const expr = stmt.namedChild(0);
    if (!expr || expr.type !== 'assignment_expression') continue;
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');
    const m = left?.text.replace(/\s+/g, '').match(/^([\w$]+)\.propTypes$/);
    if (!m || right?.type !== 'object') continue;
    const keys = right.namedChildren
      .map((p) => (p.type === 'pair' ? p.childForFieldName('key').text : p.type === 'shorthand_property_identifier' ? p.text : null))
      .filter(Boolean);
    found.set(m[1], `{${keys.join(', ')}}`);
  }
  return found;
}
