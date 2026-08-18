# preamble

Generates `PREAMBLE.md` — a compact Markdown index of a codebase, designed to be
read by AI coding agents *before* the code. Think of it as a generated header
file for a whole repo: interfaces and locations, never implementation bodies.

An agent starting a task needs three things cheaply: **where to look** (file →
purpose), **the shape of the code there** (signatures + line numbers, no
bodies), and **what connects to what** (internal imports). 
When an agent reads the generated map, it spends a fixed upfront context cost that can replace many exploratory grep glob/read calls..

```
## src/hooks/useVinScanner.js  (178 lines)  — ZXing camera VIN scanner hook
imports: react, @zxing/browser, ./lib/vinValidate
exported:
  useVinScanner(videoRef) -> {vin, error, scanning, start, stop} @ L14
    # camera lifecycle + continuous decode; auto-stops on valid VIN
internal:
  validateChecksum(vin: string) -> boolean @ L92    # ISO 3779 check digit
```

## Install & use

```sh
npm install -g @odyhibit/preamble   # after publishing
preamble --root /path/to/repo       # writes PREAMBLE.md at that repo root
preamble init --root /path/to/repo  # generate + print the agent snippet
preamble init --root /path/to/repo --hook
preamble snippet                    # agent blurb pointing agents at the map
```



## What gets indexed

Everything your `.gitignore` excludes is skipped, plus built-in defaults for
generated and vendored trees: dependency folders, build output and caches
(`dist`, `build`, `.next`, `.svelte-kit`, `.expo`, `.dart_tool`, …), and
framework copy-steps that would otherwise index your app twice — notably
Capacitor's `cap sync` copies (`android/app/src/main/assets/public`,
`ios/App/App/public`) and Cordova's root `platforms/`/`plugins/` trees and
runtime shims. Defaults only cover high-confidence generated paths; hiding
real source is treated as worse than indexing some noise.

For repo-specific tuning, add a `.preambleignore` at the root (gitignore
syntax). It loads last, so it can both add exclusions (e.g. a vendored
`qrcodegen.js` that git tracks) and re-include an over-eager default with a
`!pattern` line.

## What goes in the map

- **Exports drive visibility.** `export …`, `export default`, re-exports, and
  CommonJS `module.exports` / `exports.x` are public; everything else is
  internal-but-included (agents fix implementations, not just call them).
- **Framework-aware interfaces.** React components show their **props**; hooks
  show their **return shape**; Express/Fastify/Next route handlers show
  **METHOD + PATH**; barrel index files show a **re-export map**. These are
  pluggable refiners (`src/extractors/jsts/frameworks/`), not core logic.
- **Types are verbatim, junk excepted.** `any` and bare `{}`/`object` are
  omitted — a wrong or empty type in the map is worse than none. Plain JS gets
  types from JSDoc when present and nothing is ever fabricated.
- **Descriptions** come from the first sentence of the JSDoc/leading comment,
  blank when missing. The map is an index, not a linter: purely descriptive.
- **Line numbers** (`@ L42`) let an agent Read with an offset instead of
  searching. They are all-or-nothing per file: any content change regenerates
  the whole entry, numbers are never patched.

## How it works

The unit of the system is a **per-file entry**, cached in `.preamble/cache.json`
keyed on the file's content hash (+ extractor version). Delivery is assembly on
top of that cache — v1 ships static delivery (concatenate everything into
`PREAMBLE.md`); a JIT/query mode can later read the same cache and return only
matching entries. The cache stores structured entries, not rendered Markdown.

```
src/index.js                 generate(): walk -> cache -> extract -> assemble
src/core/walk.js             file discovery (.gitignore + built-in ignores)
src/core/cache.js            content-hash entry cache
src/core/entry.js            entry -> Markdown renderer
src/core/assemble.js         entries -> PREAMBLE.md
src/extractors/registry.js   language seam: extension -> extractor
src/extractors/jsts/         tree-sitter (WASM) JS/TS extractor + refiners
```

Parsing uses web-tree-sitter with the prebuilt WASM grammars shipped in
`tree-sitter-javascript` / `tree-sitter-typescript` — no native compilation on
any platform.

## Measuring whether it pays off (A/B)

1. Pick a repo of non-trivial size and a concrete task (e.g. "add a field to X
   and thread it through to the API").
2. **Session A:** repo as-is. Run the task in Claude Code, note `/cost`.
3. **Session B:** fresh session, same task, after `preamble` and adding the
   `preamble snippet` output to CLAUDE.md. Note `/cost`.
4. Compare total tokens and the number of Grep/Glob/Read calls in each
   transcript. The map should cut exploration noticeably; if the repo is small
   enough to read outright, it won't — that's expected. The break-even grows
   with repo size.

## Keeping it fresh

`preamble init --hook` or `preamble install-hook --root <repo>` installs a
post-commit hook that regenerates the map through the cache (only changed files
re-extract; unchanged repos take ~tens of milliseconds). 
The map's header records the generating commit as a staleness tripwire. 
Post-commit means the refreshed map lands in your *next* commit — deliberate: hooks that mutate the index mid-commit fight with partial staging.

