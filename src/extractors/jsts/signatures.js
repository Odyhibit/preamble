/**
 * Signature rendering: parameters, return types, return-shape inference.
 * Types are emitted verbatim from source, except junk types (any, {}, object)
 * which are omitted — a wrong/empty type in the map is worse than none.
 */

const JUNK_TYPES = new Set(['any', '{}', 'object', 'Object']);

/** Is this type annotation worth emitting? */
export function keepType(typeText) {
  if (!typeText) return false;
  return !JUNK_TYPES.has(typeText.trim());
}

/** Collapse internal whitespace so multi-line types render on one line. */
function squash(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a type for the map: squash whitespace, drop `import('…').`
 * prefixes (the bare name reads fine and costs a third of the tokens), cap
 * pathological lengths. Content is still verbatim source, just de-noised.
 */
export function cleanType(text) {
  const t = squash(text).replace(/import\((?:"[^"]*"|'[^']*')\)\./g, '');
  return t.length > 90 ? t.slice(0, 89) + '…' : t;
}

/**
 * Render a formal_parameters node to a compact string like
 * "(vin: string, opts = {})". jsdocParams supplies types for plain JS.
 * @param {import('web-tree-sitter').Node|null} paramsNode
 * @param {Map<string,string>} jsdocParams
 */
export function renderParams(paramsNode, jsdocParams = new Map()) {
  if (!paramsNode) return '()';
  // Arrow functions with a single bare identifier have a `parameter` field
  // instead of a formal_parameters node.
  if (paramsNode.type === 'identifier') {
    return `(${withJsdocType(paramsNode.text, jsdocParams)})`;
  }
  const parts = [];
  for (const child of paramsNode.namedChildren) {
    if (child.type === 'comment') continue;
    parts.push(renderParam(child, jsdocParams));
  }
  return `(${parts.join(', ')})`;
}

function withJsdocType(name, jsdocParams) {
  const t = jsdocParams.get(name);
  return t && keepType(t) ? `${name}: ${cleanType(t)}` : name;
}

/** Render one parameter node (TS required_parameter/optional_parameter or plain JS pattern). */
function renderParam(node, jsdocParams) {
  // TS grammar wraps every param; JS grammar puts patterns directly in the list.
  if (node.type === 'required_parameter' || node.type === 'optional_parameter') {
    const pattern = node.childForFieldName('pattern');
    const type = node.childForFieldName('type'); // type_annotation -> ": T"
    const value = node.childForFieldName('value');
    let out = pattern ? squash(pattern.text) : squash(node.text);
    if (node.type === 'optional_parameter') out += '?';
    if (type) {
      const typeText = cleanType(type.text.replace(/^:\s*/, ''));
      if (keepType(typeText)) out += `: ${typeText}`;
    }
    if (value) out += ` = ${shortValue(value)}`;
    return out;
  }
  if (node.type === 'assignment_pattern') {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    return `${squash(left.text)} = ${shortValue(right)}`;
  }
  if (node.type === 'identifier') return withJsdocType(node.text, jsdocParams);
  // object_pattern, array_pattern, rest_pattern: emit as written, squashed
  return squash(node.text);
}

/** Default values: show them when short, elide when noisy. */
function shortValue(node) {
  const t = squash(node.text);
  if (t.length <= 16) return t;
  if (node.type === 'object') return '{…}';
  if (node.type === 'array') return '[…]';
  return '…';
}

/**
 * Render a return type. TS return_type node wins; JSDoc @returns next; null if neither.
 * @returns {string|null}
 */
export function renderReturnType(returnTypeNode, jsdocReturns) {
  if (returnTypeNode) {
    const t = cleanType(returnTypeNode.text.replace(/^:\s*/, ''));
    if (keepType(t)) return t;
    return null;
  }
  if (jsdocReturns && keepType(jsdocReturns)) return cleanType(jsdocReturns);
  return null;
}

/**
 * Lossy return-shape inference for untyped functions (hooks especially):
 * if the function's own return statements return an object literal, emit its
 * keys as "{a, b, c}". Anything non-trivial -> "obj". Nothing returned -> null.
 * Deliberately not clever.
 * @param {import('web-tree-sitter').Node} fnNode function/arrow/method node
 * @returns {string|null}
 */
export function inferReturnShape(fnNode) {
  const body = fnNode.childForFieldName('body');
  if (!body) return null;
  // Arrow with expression body: () => ({a, b})
  if (body.type !== 'statement_block') {
    return shapeOf(unwrapParens(body));
  }
  const returns = [];
  collectReturns(body, returns);
  if (returns.length === 0) return null;
  const shapes = new Set(returns.map((r) => shapeOf(unwrapParens(r)) ?? 'obj'));
  if (shapes.size === 1) return shapes.values().next().value;
  return 'obj';
}

function unwrapParens(node) {
  while (node && node.type === 'parenthesized_expression') node = node.namedChild(0);
  return node;
}

/** Collect return-statement arguments in this function, skipping nested functions. */
function collectReturns(node, out) {
  for (const child of node.namedChildren) {
    if (
      child.type === 'function_declaration' ||
      child.type === 'function_expression' ||
      child.type === 'function' ||
      child.type === 'arrow_function' ||
      child.type === 'method_definition' ||
      child.type === 'class_declaration'
    ) {
      continue;
    }
    if (child.type === 'return_statement') {
      const arg = child.namedChild(0);
      if (arg) out.push(arg);
      continue;
    }
    collectReturns(child, out);
  }
}

/** "{a, b, c}" for an object literal with simple keys, "[...]" for arrays, else null. */
function shapeOf(node) {
  if (!node) return null;
  if (node.type === 'object') {
    const keys = [];
    for (const prop of node.namedChildren) {
      if (prop.type === 'pair') keys.push(squash(prop.childForFieldName('key').text));
      else if (prop.type === 'shorthand_property_identifier') keys.push(prop.text);
      else if (prop.type === 'method_definition') keys.push(prop.childForFieldName('name').text);
      else if (prop.type === 'spread_element') keys.push('…' + squash(prop.namedChild(0)?.text ?? ''));
      else return 'obj';
      if (keys.length > 10) return 'obj';
    }
    return `{${keys.join(', ')}}`;
  }
  if (node.type === 'array') return 'array';
  return null;
}
