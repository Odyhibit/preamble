/**
 * Content-hash entry cache: .preamble/cache.json at the repo root.
 * Key: file path -> {hash: sha256(content), v: extractor version, entry}.
 * Entries are structured (not rendered Markdown) so renderer changes reuse
 * the cache and a future JIT mode can query it directly.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = '.preamble';
const CACHE_FILE = 'cache.json';

export function hashContent(source) {
  return createHash('sha256').update(source).digest('hex');
}

/** @returns {{entries: Record<string, {hash: string, v: number, entry: object}>}} */
export function loadCache(root) {
  try {
    const raw = readFileSync(join(root, CACHE_DIR, CACHE_FILE), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.entries === 'object') return parsed;
  } catch {
    // missing or corrupt cache -> start fresh; it's only an optimization
  }
  return { entries: {} };
}

export function lookup(cache, path, hash, version) {
  const hit = cache.entries[path];
  if (hit && hit.hash === hash && hit.v === version) return hit.entry;
  return null;
}

export function store(cache, path, hash, version, entry) {
  cache.entries[path] = { hash, v: version, entry };
}

/** Drop cache entries for files that no longer exist. */
export function prune(cache, livePaths) {
  const live = new Set(livePaths);
  for (const path of Object.keys(cache.entries)) {
    if (!live.has(path)) delete cache.entries[path];
  }
}

export function saveCache(root, cache) {
  const dir = join(root, CACHE_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CACHE_FILE), JSON.stringify(cache));
}
