/**
 * JS/TS per-file extractor: parses one file with tree-sitter and produces a
 * structured Entry (imports, exported + internal symbols, signatures, line
 * numbers, descriptions). Framework refiners run after the base walk.
 */
import { parse, grammarForPath } from './parser.js';
import { parseJsdoc, commentFirstLine } from './jsdoc.js';
import { renderParams, renderReturnType, keepType } from './signatures.js';
import { applyRefiners } from './frameworks/index.js';

// Bump when extraction output changes shape/content: invalidates cached entries.
export const EXTRACTOR_VERSION = 1;

export const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

/**
 * @typedef {Object} SymbolInfo
 * @property {string} name
 * @property {string} kind  function|const|let|var|class|type|interface|enum|component|hook|route
 * @property {string|null} params    rendered "(a, b: T)" for function-likes
 * @property {string|null} returns   rendered return type/shape
 * @property {string} detail         non-function detail (class members, type body)
 * @property {string} desc
 * @property {number} line           1-based
 * @property {boolean} exported
 * @property {boolean} isDefault
 */

/**
 * @typedef {Object} Entry
 * @property {string} path
 * @property {number} lines
 * @property {string} purpose
 * @property {Array<{source: string, internal: boolean}>} imports
 * @property {Array<{from: string, names: string}>} reexports
 * @property {SymbolInfo[]} symbols
 * @property {boolean} barrel
 */

const FN_VALUE_TYPES = new Set(['arrow_function', 'function_expression', 'function', 'generator_function']);

/**
 * Extract an Entry from one source file. Returns null for unsupported files.
 * @returns {Promise<Entry|null>}
 */
export async function extract(source, path) {
  if (!grammarForPath(path)) return null;
  const tree = await parse(source, path);
  const root = tree.rootNode;

  /** @type {Entry} */
  const entry = {
    path,
    lines: source.split('\n').length,
    purpose: '',
    imports: [],
    reexports: [],
    symbols: [],
    barrel: false,
  };
  const namedExports = new Map(); // local name -> exported-as name
  const importSources = new Set();

  for (const node of root.namedChildren) {
    switch (node.type) {
      case 'comment':
      case 'hash_bang_line':
        break;
      case 'import_statement': {
        const src = node.childForFieldName('source');
        if (src) addImport(entry, importSources, unquote(src.text));
        break;
      }
      case 'export_statement':
        handleExport(entry, namedExports, node);
        break;
      case 'function_declaration':
      case 'generator_function_declaration':
        addFunction(entry, node, { exported: false, isDefault: false, doc: docFor(node) });
        break;
      case 'lexical_declaration':
      case 'variable_declaration':
        addVariables(entry, importSources, node, { exported: false, isDefault: false, doc: docFor(node) });
        break;
      case 'class_declaration':
      case 'abstract_class_declaration':
        addClass(entry, node, { exported: false, isDefault: false, doc: docFor(node) });
        break;
      case 'interface_declaration':
      case 'type_alias_declaration':
      case 'enum_declaration':
        addTypeDecl(entry, node, { exported: false, doc: docFor(node) });
        break;
      case 'expression_statement':
        handleCommonJs(entry, node);
        break;
      default:
        break;
    }
  }

  // export { a, b } — resolve against symbols declared elsewhere in the file
  for (const [local, alias] of namedExports) {
    const sym = entry.symbols.find((s) => s.name === local);
    if (sym) {
      sym.exported = true;
      if (alias === 'default') sym.isDefault = true;
      else if (alias !== local) sym.name = `${local} (as ${alias})`;
    }
  }

  entry.purpose = filePurpose(root, entry);
  applyRefiners(entry, { tree, source, path });
  return entry;
}

function unquote(text) {
  return text.replace(/^['"`]|['"`]$/g, '');
}

function addImport(entry, seen, source) {
  if (seen.has(source)) return;
  seen.add(source);
  entry.imports.push({ source, internal: source.startsWith('.') || source.startsWith('/') });
}

/**
 * Preceding JSDoc for a top-level node — only if directly adjacent (no blank
 * line), so a detached top-of-file comment stays the file purpose instead of
 * leaking onto the first declaration.
 */
function docFor(node) {
  const prev = node.previousNamedSibling;
  if (
    prev &&
    prev.type === 'comment' &&
    prev.text.startsWith('/**') &&
    prev.endPosition.row === node.startPosition.row - 1
  ) {
    return parseJsdoc(prev.text);
  }
  return parseJsdoc('');
}

function handleExport(entry, namedExports, node) {
  const doc = docFor(node);
  const isDefault = node.children.some((c) => c.type === 'default');
  const source = node.childForFieldName('source');
  const decl = node.childForFieldName('declaration');

  if (source) {
    // export { a, b } from './x'  |  export * from './x'
    const clause = node.namedChildren.find((c) => c.type === 'export_clause' || c.type === 'namespace_export');
    const names = clause ? clause.text.replace(/\s+/g, ' ') : '*';
    entry.reexports.push({ from: unquote(source.text), names });
    return;
  }
  if (decl) {
    const opts = { exported: true, isDefault, doc };
    switch (decl.type) {
      case 'function_declaration':
      case 'generator_function_declaration':
        addFunction(entry, decl, opts);
        return;
      case 'lexical_declaration':
      case 'variable_declaration':
        addVariables(entry, new Set(), decl, opts);
        return;
      case 'class_declaration':
      case 'abstract_class_declaration':
        addClass(entry, decl, opts);
        return;
      case 'interface_declaration':
      case 'type_alias_declaration':
      case 'enum_declaration':
        addTypeDecl(entry, decl, opts);
        return;
      default:
        return;
    }
  }
  // export default <expression>
  const value = node.childForFieldName('value') ?? (isDefault ? node.namedChildren.at(-1) : null);
  if (isDefault && value) {
    if (value.type === 'identifier') {
      // export default foo — mark the earlier declaration
      namedExports.set(value.text, 'default');
    } else if (FN_VALUE_TYPES.has(value.type)) {
      addFunctionLike(entry, 'default', value, { exported: true, isDefault: true, doc });
    } else {
      pushSymbol(entry, {
        name: 'default', kind: 'const', params: null, returns: null,
        detail: '', desc: doc.desc, line: line(node), exported: true, isDefault: true,
      });
    }
    return;
  }
  // export { a, b as c }
  const clause = node.namedChildren.find((c) => c.type === 'export_clause');
  if (clause) {
    for (const spec of clause.namedChildren) {
      if (spec.type !== 'export_specifier') continue;
      const local = spec.childForFieldName('name')?.text;
      const alias = spec.childForFieldName('alias')?.text ?? local;
      if (local) namedExports.set(local, alias);
    }
  }
}

function line(node) {
  return node.startPosition.row + 1;
}

function pushSymbol(entry, sym) {
  entry.symbols.push(sym);
}

function addFunction(entry, node, opts) {
  const name = node.childForFieldName('name')?.text ?? 'default';
  addFunctionLike(entry, name, node, opts);
}

/** Shared path for function declarations, arrows, and function expressions. */
function addFunctionLike(entry, name, fnNode, { exported, isDefault, doc }, declLine) {
  const paramsNode = fnNode.childForFieldName('parameters') ?? fnNode.childForFieldName('parameter');
  const returns = renderReturnType(fnNode.childForFieldName('return_type'), doc.returns);
  pushSymbol(entry, {
    name,
    kind: 'function',
    params: renderParams(paramsNode, doc.params),
    returns,
    detail: '',
    desc: doc.desc,
    line: declLine ?? line(fnNode),
    exported,
    isDefault,
    _node: fnNode, // consumed (and stripped) by refiners; never serialized
  });
}

function addVariables(entry, importSources, node, { exported, isDefault, doc }) {
  for (const declarator of node.namedChildren) {
    if (declarator.type !== 'variable_declarator') continue;
    const nameNode = declarator.childForFieldName('name');
    const value = declarator.childForFieldName('value');
    const name = nameNode?.text ?? '?';

    // const x = require('./y') is an import, not a symbol
    if (value && value.type === 'call_expression' && value.childForFieldName('function')?.text === 'require') {
      const arg = value.childForFieldName('arguments')?.namedChild(0);
      if (arg && arg.type === 'string') {
        addImport(entry, importSources, unquote(arg.text));
        continue;
      }
    }
    if (value && FN_VALUE_TYPES.has(value.type)) {
      addFunctionLike(entry, name, value, { exported, isDefault, doc }, line(declarator));
      continue;
    }
    const typeNode = declarator.childForFieldName('type');
    let detail = '';
    if (typeNode) {
      const t = typeNode.text.replace(/^:\s*/, '').replace(/\s+/g, ' ');
      if (keepType(t)) detail = `: ${t}`;
    }
    pushSymbol(entry, {
      name,
      kind: node.type === 'variable_declaration' ? 'var' : node.text.startsWith('let') ? 'let' : 'const',
      params: null,
      returns: null,
      detail,
      desc: doc.desc,
      line: line(declarator),
      exported,
      isDefault,
      _node: value ?? declarator,
    });
  }
}

function addClass(entry, node, { exported, isDefault, doc }) {
  const name = node.childForFieldName('name')?.text ?? 'default';
  const heritage = node.namedChildren.find((c) => c.type === 'class_heritage');
  const body = node.childForFieldName('body');
  const methods = [];
  if (body) {
    for (const member of body.namedChildren) {
      if (member.type !== 'method_definition') continue;
      const mName = member.childForFieldName('name')?.text ?? '';
      if (mName.startsWith('#')) continue; // private by language semantics
      const mParams = member.childForFieldName('parameters');
      methods.push(`${mName}${mParams ? mParams.text.replace(/\s+/g, ' ') : '()'}`);
      if (methods.length === 8) {
        methods.push('…');
        break;
      }
    }
  }
  const heritageText = heritage ? ` ${heritage.text.replace(/\s+/g, ' ')}` : '';
  pushSymbol(entry, {
    name,
    kind: 'class',
    params: null,
    returns: null,
    detail: `${heritageText}${methods.length ? ` { ${methods.join(', ')} }` : ''}`,
    desc: doc.desc,
    line: line(node),
    exported,
    isDefault,
  });
}

function addTypeDecl(entry, node, { exported, doc }) {
  const name = node.childForFieldName('name')?.text ?? '?';
  const kind = node.type === 'interface_declaration' ? 'interface' : node.type === 'enum_declaration' ? 'enum' : 'type';
  let detail = '';
  if (kind === 'type') {
    const value = node.childForFieldName('value');
    if (value) detail = ` = ${truncate(value.text.replace(/\s+/g, ' '), 90)}`;
  } else if (kind === 'interface') {
    const body = node.childForFieldName('body');
    if (body) detail = ` ${truncate(body.text.replace(/\s+/g, ' '), 90)}`;
  } else {
    const body = node.childForFieldName('body');
    if (body) {
      const members = body.namedChildren.map((m) => m.childForFieldName('name')?.text ?? m.text).filter(Boolean);
      detail = ` { ${truncate(members.join(', '), 80)} }`;
    }
  }
  pushSymbol(entry, {
    name, kind, params: null, returns: null, detail,
    desc: doc.desc, line: line(node), exported, isDefault: false,
  });
}

function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** module.exports = …  /  exports.x = …  /  module.exports.x = … */
function handleCommonJs(entry, stmtNode) {
  const expr = stmtNode.namedChild(0);
  if (!expr || expr.type !== 'assignment_expression') return;
  const left = expr.childForFieldName('left');
  const right = expr.childForFieldName('right');
  if (!left || left.type !== 'member_expression') return;
  const leftText = left.text.replace(/\s+/g, '');
  const doc = docFor(stmtNode);

  if (leftText === 'module.exports' || leftText === 'exports') {
    if (right.type === 'object') {
      for (const prop of right.namedChildren) {
        if (prop.type === 'shorthand_property_identifier') {
          markExported(entry, prop.text);
        } else if (prop.type === 'pair') {
          const key = prop.childForFieldName('key').text;
          const value = prop.childForFieldName('value');
          if (value.type === 'identifier') markExported(entry, value.text, key);
          else if (FN_VALUE_TYPES.has(value.type)) {
            addFunctionLike(entry, key, value, { exported: true, isDefault: false, doc: parseJsdoc('') }, line(prop));
          } else markExported(entry, key);
        }
      }
    } else if (right.type === 'identifier') {
      markExported(entry, right.text, null, true);
    } else if (FN_VALUE_TYPES.has(right.type)) {
      addFunctionLike(entry, 'default', right, { exported: true, isDefault: true, doc });
    } else if (right.type === 'class' || right.type === 'class_declaration') {
      addClass(entry, right, { exported: true, isDefault: true, doc });
    }
    return;
  }
  const dotExport = leftText.match(/^(?:module\.)?exports\.([\w$]+)$/);
  if (dotExport) {
    const name = dotExport[1];
    if (right.type === 'identifier') markExported(entry, right.text, name);
    else if (FN_VALUE_TYPES.has(right.type)) {
      addFunctionLike(entry, name, right, { exported: true, isDefault: false, doc }, line(stmtNode));
    } else {
      pushSymbol(entry, {
        name, kind: 'const', params: null, returns: null, detail: '',
        desc: doc.desc, line: line(stmtNode), exported: true, isDefault: false,
      });
    }
  }
}

function markExported(entry, localName, alias = null, isDefault = false) {
  const sym = entry.symbols.find((s) => s.name === localName);
  if (!sym) return;
  sym.exported = true;
  if (isDefault) sym.isDefault = true;
  if (alias && alias !== localName) sym.name = `${localName} (as ${alias})`;
}

/**
 * File one-liner: a top-of-file comment separated from the first statement by
 * a blank line (or bearing @file/@fileoverview/@module), else the default
 * export's description, else the sole export's description, else ''.
 */
function filePurpose(root, entry) {
  const first = root.namedChildren.find((c) => c.type !== 'hash_bang_line');
  if (first && first.type === 'comment' && first.startPosition.row <= 2) {
    const next = first.nextNamedSibling;
    // Detached, tagged @file, or sitting above an import (imports take no
    // docs) -> it describes the file, not the next declaration.
    const detached = !next || next.startPosition.row > first.endPosition.row + 1;
    const doc = parseJsdoc(first.text);
    const hasFileTag = doc.tags.has('file') || doc.tags.has('fileoverview') || doc.tags.has('module');
    if (detached || hasFileTag || next?.type === 'comment' || next?.type === 'import_statement') {
      const purpose = commentFirstLine(first.text);
      if (purpose) return purpose;
    }
  }
  const def = entry.symbols.find((s) => s.isDefault && s.desc);
  if (def) return def.desc;
  const exported = entry.symbols.filter((s) => s.exported);
  if (exported.length === 1 && exported[0].desc) return exported[0].desc;
  return '';
}
