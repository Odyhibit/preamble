/**
 * Lazy tree-sitter setup. Loads WASM grammars once per process and picks the
 * right language for a file extension.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Parser, Language } from 'web-tree-sitter';

const require = createRequire(import.meta.url);

/** @type {Map<string, Language>} grammar name -> loaded language */
const languages = new Map();
let initialized = false;
/** @type {Parser} */
let parser;

const GRAMMAR_FOR_EXT = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
};

function wasmPath(grammar) {
  if (grammar === 'javascript') {
    return join(dirname(require.resolve('tree-sitter-javascript/package.json')), 'tree-sitter-javascript.wasm');
  }
  // typescript and tsx both live in the tree-sitter-typescript package
  return join(dirname(require.resolve('tree-sitter-typescript/package.json')), `tree-sitter-${grammar}.wasm`);
}

export function grammarForPath(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return GRAMMAR_FOR_EXT[ext] ?? null;
}

/**
 * Parse source for the given file path. Returns null for unsupported extensions.
 * @returns {Promise<import('web-tree-sitter').Tree | null>}
 */
export async function parse(source, filePath) {
  const grammar = grammarForPath(filePath);
  if (!grammar) return null;
  if (!initialized) {
    await Parser.init();
    parser = new Parser();
    initialized = true;
  }
  if (!languages.has(grammar)) {
    languages.set(grammar, await Language.load(wasmPath(grammar)));
  }
  parser.setLanguage(languages.get(grammar));
  return parser.parse(source);
}
