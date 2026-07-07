/**
 * Framework refiner registry. Each refiner inspects the base entry (and the
 * raw AST via ctx) and rewrites symbols whose *real* interface isn't their
 * function signature. Order matters: hooks before react (useX is never a
 * component), barrel last (it needs the final symbol list).
 */
import { refineHooks } from './hooks.js';
import { refineReact } from './react.js';
import { refineRoutes } from './routes.js';
import { refineBarrel } from './barrel.js';

const refiners = [refineHooks, refineReact, refineRoutes, refineBarrel];

/**
 * @param {import('../index.js').Entry} entry  mutated in place
 * @param {{tree: import('web-tree-sitter').Tree, source: string, path: string}} ctx
 */
export function applyRefiners(entry, ctx) {
  for (const refine of refiners) refine(entry, ctx);
  // Strip AST handles so entries are plain JSON for the cache.
  for (const sym of entry.symbols) delete sym._node;
}
