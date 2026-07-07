import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from '../src/extractors/jsts/index.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function extractFixture(rel) {
  return extract(readFileSync(join(fixtures, rel), 'utf8'), `test/fixtures/${rel}`);
}

function sym(entry, name) {
  const s = entry.symbols.find((s) => s.name === name || s.name.startsWith(name + ' '));
  assert.ok(s, `symbol ${name} missing from ${entry.path}`);
  return s;
}

test('hook: return shape is the interface, purpose from top comment', async () => {
  const entry = await extractFixture('useVinScanner.js');
  assert.equal(entry.purpose, 'ZXing camera VIN scanner hook');
  const hook = sym(entry, 'useVinScanner');
  assert.equal(hook.kind, 'hook');
  assert.equal(hook.exported, true);
  assert.equal(hook.returns, '{vin, error, scanning, start, stop}');
  assert.equal(hook.line, 10);
});

test('plain JS: JSDoc types used, absent types omitted, internals included', async () => {
  const entry = await extractFixture('useVinScanner.js');
  const checksum = sym(entry, 'validateChecksum');
  assert.equal(checksum.exported, false);
  assert.equal(checksum.params, '(vin: string)');
  assert.equal(checksum.returns, 'boolean');
  assert.equal(checksum.desc, 'ISO 3779 check digit');
  const normalize = sym(entry, 'normalizeVin');
  assert.equal(normalize.params, '(raw)'); // no JSDoc type -> no fabricated type
});

test('imports: internal vs package, require() counts', async () => {
  const scanner = await extractFixture('useVinScanner.js');
  assert.deepEqual(
    scanner.imports.map((i) => [i.source, i.internal]),
    [['react', false], ['@zxing/browser', false], ['./lib/vinValidate.js', true]]
  );
  const server = await extractFixture('server.js');
  assert.deepEqual(server.imports.map((i) => i.source), ['express', './lib/decode.js']);
});

test('TS component: props type is the interface, junk types dropped', async () => {
  const entry = await extractFixture('Scanner.tsx');
  const scanner = sym(entry, 'Scanner');
  assert.equal(scanner.kind, 'component');
  assert.equal(scanner.isDefault, true);
  assert.equal(scanner.params, '(props: ScannerProps)');
  const chip = sym(entry, 'StatusChip');
  assert.equal(chip.params, '(props: { state: ScanState })');
  const log = sym(entry, 'logEvent');
  assert.equal(log.params, '(payload, meta)'); // any and {} omitted
  assert.equal(log.returns, 'void');
});

test('TS declarations: interface/type/enum recorded verbatim', async () => {
  const entry = await extractFixture('shapes/types.ts');
  const iface = sym(entry, 'DecodedVin');
  assert.equal(iface.kind, 'interface');
  assert.equal(iface.desc, ''); // detached top comment belongs to the file, not this
  assert.equal(entry.purpose, 'Shared VIN domain types.');
  assert.equal(sym(entry, 'Region').kind, 'enum');
});

test('JS component: destructured props / propTypes are the interface', async () => {
  const entry = await extractFixture('LegacyBadge.jsx');
  const badge = sym(entry, 'LegacyBadge');
  assert.equal(badge.kind, 'component');
  assert.equal(badge.isDefault, true);
  assert.equal(badge.exported, true); // via `export default LegacyBadge`
  assert.equal(badge.params, '({count, color, onClick})');
});

test('routes: METHOD + PATH is the interface; CJS module.exports = {…}', async () => {
  const entry = await extractFixture('server.js');
  const get = sym(entry, 'GET /api/vin/:vin');
  assert.equal(get.kind, 'route');
  assert.equal(get.line, 8);
  sym(entry, 'POST /api/vin/batch');
  assert.equal(sym(entry, 'app').exported, true);
  assert.equal(sym(entry, 'startServer').exported, true);
  assert.equal(sym(entry, 'handleBatch').exported, false);
});

test('CJS: exports.x and module.exports.x with JSDoc types', async () => {
  const entry = await extractFixture('mathUtils.cjs');
  const ws = sym(entry, 'weightedSum');
  assert.equal(ws.exported, true);
  assert.equal(ws.params, '(vin: string, weights: number[])');
  assert.equal(ws.returns, 'number');
  assert.equal(sym(entry, 'checkDigit').exported, true);
});

test('barrel: re-export map, no owned symbols', async () => {
  const entry = await extractFixture('shapes/index.ts');
  assert.equal(entry.barrel, true);
  assert.equal(entry.symbols.length, 0);
  assert.deepEqual(entry.reexports.map((r) => r.from), ['./types.js', '../Scanner.js']);
});
