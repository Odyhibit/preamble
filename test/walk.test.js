import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { walk } from '../src/core/walk.js';

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'preamble-walk-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

test('walk: framework build output is ignored, source is not', () => {
  const root = makeTree({
    'www/js/app.js': '',
    'src/plugins/auth.js': '', // nested plugins/ is real source
    // Capacitor sync copies + Cordova shims
    'android/app/src/main/assets/public/js/app.js': '',
    'ios/App/App/public/js/app.js': '',
    'www/cordova.js': '',
    'www/cordova_plugins.js': '',
    // root-level Cordova trees
    'platforms/android/x.js': '',
    'plugins/cordova-plugin-camera/y.js': '',
    // misc generated
    '.expo/settings.js': '',
    '.svelte-kit/generated/root.js': '',
    'node_modules/pkg/index.js': '',
    'coverage/lcov-report/prettify.js': '',
    'app.min.js': '',
    'types.d.ts': '',
  });
  try {
    assert.deepEqual(walk(root, ['.js', '.ts']), ['src/plugins/auth.js', 'www/js/app.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('walk: .preambleignore adds exclusions and can negate defaults', () => {
  const root = makeTree({
    'www/js/app.js': '',
    'www/js/qrcodegen.js': '',
    'platforms/android/x.js': '',
    '.preambleignore': 'qrcodegen.js\n!/platforms\n',
  });
  try {
    assert.deepEqual(walk(root, ['.js']), ['platforms/android/x.js', 'www/js/app.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('walk: .gitignore is honored', () => {
  const root = makeTree({
    'src/a.js': '',
    'generated/b.js': '',
    '.gitignore': 'generated/\n',
  });
  try {
    assert.deepEqual(walk(root, ['.js']), ['src/a.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
