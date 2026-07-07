# PREAMBLE

> Codebase map for coding agents: interfaces and locations, no implementation.
> Generated at commit 298e691 on 2026-07-07 — 28 files, 1,646 source lines.
> If this commit is far behind HEAD, regenerate with `preamble` before trusting line numbers.
> Symbol lines end with `@ L<n>`; Read the file at that offset instead of searching.

## Files

- bin/preamble.js
- src/cli.js — CLI: `preamble` (generate, the default), `preamble install-hook`, `preamble snippet`.
- src/core/assemble.js — Static delivery: render all entries into one PREAMBLE.md.
- src/core/cache.js — Content-hash entry cache: .preamble/cache.json at the repo root.
- src/core/entry.js — Entry -> Markdown renderer.
- src/core/walk.js — File discovery: enumerate extractable source files under a root, honoring the root .gitignore plus built-in ignores.
- src/extractors/jsts/frameworks/barrel.js — Barrel refiner: an index file that only re-exports owns no interface — record it as a re-export map, not as symbols.
- src/extractors/jsts/frameworks/hooks.js — Hook refiner: for use* functions the RETURN SHAPE is the interface.
- src/extractors/jsts/frameworks/index.js — Framework refiner registry.
- src/extractors/jsts/frameworks/react.js — React refiner: for components the PROPS are the interface, not `(props)`.
- src/extractors/jsts/frameworks/routes.js — Route refiner: for HTTP handlers the METHOD + PATH is the interface.
- src/extractors/jsts/index.js — JS/TS per-file extractor: parses one file with tree-sitter and produces a structured Entry (imports, exported + interna…
- src/extractors/jsts/jsdoc.js — JSDoc parsing: descriptions and (for plain JS) param/return types.
- src/extractors/jsts/parser.js — Lazy tree-sitter setup.
- src/extractors/jsts/signatures.js — Signature rendering: parameters, return types, return-shape inference.
- src/extractors/registry.js — Extractor registry: the language seam.
- src/hook/post-commit.js — Git post-commit hook installer.
- src/hook/snippet.js — The CLAUDE.md blurb that tells agents the map exists and how to use it.
- src/index.js — Programmatic API.
- test/cache.test.js
- test/extract.test.js
- test/fixtures/LegacyBadge.jsx — Colored count badge (legacy, PropTypes-era).
- test/fixtures/Scanner.tsx — Camera viewport with VIN overlay; wraps useVinScanner.
- test/fixtures/mathUtils.cjs — checksum math helpers (CommonJS)
- test/fixtures/server.js — VIN lookup HTTP API
- test/fixtures/shapes/index.ts — barrel — re-exports from ./types.js, ../Scanner.js
- test/fixtures/shapes/types.ts — Shared VIN domain types.
- test/fixtures/useVinScanner.js — ZXing camera VIN scanner hook

---

## bin/preamble.js  (11 lines)
imports: ../src/cli.js

## src/cli.js  (53 lines)  — CLI: `preamble` (generate, the default), `preamble install-hook`, `preamble snippet`.
imports: ./index.js, ./hook/post-commit.js, ./hook/snippet.js
exported:
  run(argv) @ L17
internal:
  HELP @ L9

## src/core/assemble.js  (49 lines)  — Static delivery: render all entries into one PREAMBLE.md.
imports: node:child_process, ./entry.js
exported:
  assemble(entries: Entry[], { root }) -> string @ L14
internal:
  gitCommit(root) @ L40

## src/core/cache.js  (53 lines)  — Content-hash entry cache: .preamble/cache.json at the repo root.
imports: node:crypto, node:fs, node:path
exported:
  hashContent(source) @ L14
  loadCache(root) -> {entries: Record<string, {hash: string, v: number, entry: object}>} @ L19
  lookup(cache, path, hash, version) @ L30
  store(cache, path, hash, version, entry) @ L36
  prune(cache, livePaths) @ L41    # Drop cache entries for files that no longer exist.
  saveCache(root, cache) @ L48
internal:
  CACHE_DIR @ L11
  CACHE_FILE @ L12

## src/core/entry.js  (55 lines)  — Entry -> Markdown renderer.
exported:
  renderEntry(entry: Entry) @ L10
internal:
  DESC_INLINE_LIMIT @ L7
  renderSymbol(sym: SymbolInfo) @ L37

## src/core/walk.js  (53 lines)  — File discovery: enumerate extractable source files under a root, honoring the root .gitignore plus built-in ignores.
imports: node:fs, node:path, ignore
exported:
  walk(root: string, extensions: string[]) -> string[] @ L21
internal:
  DEFAULT_IGNORES @ L10
  walkDir(root, dir, ig, extSet, results) @ L33

## src/extractors/jsts/frameworks/barrel.js  (13 lines)  — Barrel refiner: an index file that only re-exports owns no interface — record it as a re-export map, not as symbols.
exported:
  refineBarrel(entry) @ L6

## src/extractors/jsts/frameworks/hooks.js  (17 lines)  — Hook refiner: for use* functions the RETURN SHAPE is the interface.
imports: ../signatures.js
exported:
  refineHooks(entry) @ L8

## src/extractors/jsts/frameworks/index.js  (23 lines)  — Framework refiner registry.
imports: ./hooks.js, ./react.js, ./routes.js, ./barrel.js
exported:
  applyRefiners(entry: Entry, ctx: {tree: Tree, source: string, path: string}) @ L18
internal:
  refiners @ L12

## src/extractors/jsts/frameworks/react.js  (65 lines)  — React refiner: for components the PROPS are the interface, not `(props)`.
exported:
  refineReact(entry, ctx) @ L8
internal:
  propsInterface(fnNode) @ L24
    # Props from the first parameter: TS type annotation or destructuring pattern.
  collectPropTypes(root) @ L48
    # Component.propTypes = { … } assignments anywhere in the file -> name -> "{keys}".

## src/extractors/jsts/frameworks/routes.js  (76 lines)  — Route refiner: for HTTP handlers the METHOD + PATH is the interface.
exported:
  refineRoutes(entry, ctx) @ L11
internal:
  HTTP_METHODS @ L7
  ROUTER_NAMES @ L8
  NEXT_HANDLERS @ L9
  collectRouteCalls(node, out) @ L56

## src/extractors/jsts/index.js  (421 lines)  — JS/TS per-file extractor: parses one file with tree-sitter and produces a structured Entry (imports, exported + interna…
imports: ./parser.js, ./jsdoc.js, ./signatures.js, ./frameworks/index.js
exported:
  EXTRACTOR_VERSION @ L12
  EXTENSIONS @ L14
  extract(source, path) -> Promise<Entry|null> @ L46    # Extract an Entry from one source file.
internal:
  FN_VALUE_TYPES @ L40
  unquote(text) @ L117
  addImport(entry, seen, source) @ L121
  docFor(node) @ L132
    # Preceding JSDoc for a top-level node — only if directly adjacent (no blank line), so a detached top-of-file comment sta…
  handleExport(entry, namedExports, node) @ L145
  line(node) @ L210
  pushSymbol(entry, sym) @ L214
  addFunction(entry, node, opts) @ L218
  addFunctionLike(entry, name, fnNode, { exported, isDefault, doc }, declLine) @ L224
    # Shared path for function declarations, arrows, and function expressions.
  addVariables(entry, importSources, node, { exported, isDefault, doc }) @ L241
  addClass(entry, node, { exported, isDefault, doc }) @ L281
  addTypeDecl(entry, node, { exported, doc }) @ L313
  truncate(text, max) @ L336
  handleCommonJs(entry, stmtNode) @ L341
    # module.exports = …  /  exports.x = …  /  module.exports.x = …
  markExported(entry, localName, alias = null, isDefault = false) @ L388
  filePurpose(root, entry) @ L401
    # File one-liner: a top-of-file comment separated from the first statement by a blank line (or bearing @file/@fileovervie…

## src/extractors/jsts/jsdoc.js  (93 lines)  — JSDoc parsing: descriptions and (for plain JS) param/return types.
exported:
  parseJsdoc(commentText) -> {desc: string, params: Map<string, string>, returns: string|null, tags: Set<string>} @ L10
    # Parse a JSDoc comment's text (including the comment markers).
  firstSentence(text) @ L63
    # First sentence of the first paragraph, with wrapped lines rejoined.
  commentFirstLine(commentText) @ L84
    # Extract a one-line description from any leading comment (JSDoc or //).
internal:
  bracedType(text) @ L50    # Contents of a balanced {...} at the start of text, or null.

## src/extractors/jsts/parser.js  (57 lines)  — Lazy tree-sitter setup.
imports: node:module, node:path, web-tree-sitter
exported:
  grammarForPath(filePath) @ L34
  parse(source, filePath) -> Promise<Tree | null> @ L43
    # Parse source for the given file path.
internal:
  require @ L9
  languages @ L12
  initialized @ L13
  parser @ L15
  GRAMMAR_FOR_EXT @ L17
  wasmPath(grammar) @ L26

## src/extractors/jsts/signatures.js  (173 lines)  — Signature rendering: parameters, return types, return-shape inference.
exported:
  keepType(typeText) @ L10    # Is this type annotation worth emitting?
  cleanType(text) @ L25
    # Normalize a type for the map: squash whitespace, drop `import('…').` prefixes (the bare name reads fine and costs a thi…
  renderParams(paramsNode: Node|null, jsdocParams = new Map()) @ L36
    # Render a formal_parameters node to a compact string like "(vin: string, opts = {})".
  renderReturnType(returnTypeNode, jsdocReturns) -> string|null @ L95    # Render a return type.
  inferReturnShape(fnNode: Node) -> string|null @ L113
    # Lossy return-shape inference for untyped functions (hooks especially): if the function's own return statements return a…
internal:
  JUNK_TYPES @ L7
  squash(text) @ L16    # Collapse internal whitespace so multi-line types render on one line.
  withJsdocType(name, jsdocParams) @ L51
  renderParam(node, jsdocParams) @ L57
    # Render one parameter node (TS required_parameter/optional_parameter or plain JS pattern).
  shortValue(node) @ L83    # Default values: show them when short, elide when noisy.
  unwrapParens(node) @ L128
  collectReturns(node, out) @ L134
    # Collect return-statement arguments in this function, skipping nested functions.
  shapeOf(node) @ L156
    # "{a, b, c}" for an object literal with simple keys, "[...]" for arrays, else null.

## src/extractors/registry.js  (22 lines)  — Extractor registry: the language seam.
imports: ./jsts/index.js
exported:
  allExtensions() @ L13    # All extensions any registered extractor can handle.
  extractorFor(path) -> {name: string, version: number, extract: Function}|null @ L18
internal:
  extractors @ L8

## src/hook/post-commit.js  (38 lines)  — Git post-commit hook installer.
imports: node:fs, node:path
exported:
  installHook(root) @ L21
internal:
  HOOK_BODY @ L14
  MARKER @ L19

## src/hook/snippet.js  (11 lines)  — The CLAUDE.md blurb that tells agents the map exists and how to use it.
exported:
  claudeSnippet() @ L3

## src/index.js  (59 lines)  — Programmatic API.
imports: node:fs, node:path, ./core/walk.js, ./core/cache.js, ./core/assemble.js, ./extractors/registry.js
exported:
  generate({ root = process.cwd(), force = false, write = true } = {}) -> Promise<{entries: object[], stats: {files: number, extracted: number, cached: number}, ou… @ L18

## test/cache.test.js  (37 lines)
imports: node:test, node:assert/strict, node:fs, node:os, node:path, ../src/core/cache.js

## test/extract.test.js  (108 lines)
imports: node:test, node:assert/strict, node:fs, node:path, node:url, ../src/extractors/jsts/index.js
internal:
  fixtures @ L8
  extractFixture(rel) @ L10
  sym(entry, name) @ L14

## test/fixtures/LegacyBadge.jsx  (15 lines)  — Colored count badge (legacy, PropTypes-era).
imports: prop-types
exported:
  LegacyBadge({count, color, onClick}) (default) @ L4
    # Colored count badge (legacy, PropTypes-era).

## test/fixtures/Scanner.tsx  (25 lines)  — Camera viewport with VIN overlay; wraps useVinScanner.
imports: ./useVinScanner.js
exported:
  interface ScannerProps { onScan: (vin: string) => void; timeoutMs?: number; overlay: React.ReactNode; } @ L3
  type ScanState = 'idle' | 'scanning' | 'done' @ L9
  Scanner(props: ScannerProps) (default) @ L12
    # Camera viewport with VIN overlay; wraps useVinScanner.
  StatusChip(props: { state: ScanState }) @ L17    # Small inline status chip.
  logEvent(payload, meta) -> void @ L22

## test/fixtures/mathUtils.cjs  (15 lines)  — checksum math helpers (CommonJS)
exported:
  weightedSum(vin: string, weights: number[]) -> number @ L9
    # Weighted sum of transliterated VIN characters.
  checkDigit(sum) @ L14    # Modulo-11 check digit.

## test/fixtures/server.js  (26 lines)  — VIN lookup HTTP API
imports: express, ./lib/decode.js
exported:
  app @ L6
  startServer(port = 3000) @ L21
  GET /api/vin/:vin @ L8
  POST /api/vin/batch @ L12
internal:
  handleBatch(req, res) @ L17    # Decode up to 50 VINs per request.

## test/fixtures/shapes/index.ts  (3 lines)  — barrel — re-exports from ./types.js, ../Scanner.js
re-exports: * from ./types.js, { default as Scanner } from ../Scanner.js

## test/fixtures/shapes/types.ts  (19 lines)  — Shared VIN domain types.
exported:
  interface DecodedVin { vin: string; make: string; model: string; year: number; } @ L3
  type VinResult = { ok: true; decoded: DecodedVin } | { ok: false; error: string } @ L10
  enum Region { NorthAmerica, Europe, Asia } @ L12
internal:
  REGION_PREFIXES @ L18

## test/fixtures/useVinScanner.js  (56 lines)  — ZXing camera VIN scanner hook
imports: react, @zxing/browser, ./lib/vinValidate.js
exported:
  useVinScanner(videoRef) -> {vin, error, scanning, start, stop} @ L10
    # camera lifecycle + continuous decode; auto-stops on valid VIN
internal:
  validateChecksum(vin: string) -> boolean @ L39    # ISO 3779 check digit
  normalizeVin(raw) @ L47    # uppercase, strip I/O/Q
  transliterate(c) @ L51
  WEIGHTS @ L55
