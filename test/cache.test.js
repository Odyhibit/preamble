import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCache, saveCache, lookup, store, prune, hashContent } from '../src/core/cache.js';

test('cache: hit on same hash+version, miss on either changing', () => {
  const cache = { entries: {} };
  const hash = hashContent('const a = 1;');
  store(cache, 'src/a.js', hash, 1, { path: 'src/a.js' });

  assert.deepEqual(lookup(cache, 'src/a.js', hash, 1), { path: 'src/a.js' });
  assert.equal(lookup(cache, 'src/a.js', hashContent('const a = 2;'), 1), null); // content changed
  assert.equal(lookup(cache, 'src/a.js', hash, 2), null); // extractor bumped
});

test('cache: prune drops deleted files, survives save/load round trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preamble-'));
  try {
    const cache = { entries: {} };
    store(cache, 'src/a.js', 'h1', 1, { path: 'src/a.js' });
    store(cache, 'src/gone.js', 'h2', 1, { path: 'src/gone.js' });
    prune(cache, ['src/a.js']);
    saveCache(dir, cache);

    const reloaded = loadCache(dir);
    assert.deepEqual(Object.keys(reloaded.entries), ['src/a.js']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cache: corrupt or missing file starts fresh instead of throwing', () => {
  assert.deepEqual(loadCache('/nonexistent/path'), { entries: {} });
});
