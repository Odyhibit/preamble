/**
 * Programmatic API. `generate` walks, extracts (through the cache), and
 * writes PREAMBLE.md. It also returns the structured entries — that return
 * value is the seam a future JIT/query mode builds on: same cache, same
 * entries, different delivery.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { walk } from './core/walk.js';
import { loadCache, saveCache, lookup, store, prune, hashContent } from './core/cache.js';
import { assemble } from './core/assemble.js';
import { extractorFor, allExtensions } from './extractors/registry.js';

/**
 * @param {{root?: string, force?: boolean, write?: boolean}} opts
 * @returns {Promise<{entries: object[], stats: {files: number, extracted: number, cached: number}, outputPath: string|null}>}
 */
export async function generate({ root = process.cwd(), force = false, write = true } = {}) {
  const paths = walk(root, allExtensions());
  const cache = force ? { entries: {} } : loadCache(root);
  const entries = [];
  let extracted = 0;
  let cached = 0;

  for (const path of paths) {
    const extractor = extractorFor(path);
    if (!extractor) continue;
    let source;
    try {
      source = readFileSync(join(root, path), 'utf8');
    } catch {
      continue;
    }
    const hash = hashContent(source);
    let entry = lookup(cache, path, hash, extractor.version);
    if (entry) {
      cached++;
    } else {
      // Any content change regenerates the whole entry — line numbers are
      // all-or-nothing per file, never patched.
      entry = await extractor.extract(source, path);
      if (!entry) continue;
      store(cache, path, hash, extractor.version, entry);
      extracted++;
    }
    entries.push(entry);
  }

  prune(cache, paths);
  saveCache(root, cache);

  let outputPath = null;
  if (write) {
    outputPath = join(root, 'PREAMBLE.md');
    writeFileSync(outputPath, assemble(entries, { root }));
  }
  return { entries, stats: { files: paths.length, extracted, cached }, outputPath };
}
