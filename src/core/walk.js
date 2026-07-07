/**
 * File discovery: enumerate extractable source files under a root, honoring
 * the root .gitignore plus built-in ignores. Returns repo-relative POSIX paths.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ignoreFactory from 'ignore';

// Always ignored regardless of .gitignore: generated or vendored trees and our
// own output. Rule for additions: only paths that are high-confidence
// generated/copied — hiding real source is worse than indexing some noise.
// Repo-specific exclusions belong in .preambleignore, which can also negate
// (`!pattern`) anything listed here.
const DEFAULT_IGNORES = [
  // vcs, tooling, our own artifacts
  '.git', '.preamble', '.claude', '.idea', '.vscode',
  // dependency + vendor trees
  'node_modules', 'bower_components', 'vendor', 'Pods', '.yarn', '.venv',
  // generic build output + caches
  'dist', 'build', 'out', 'coverage', '.cache', '.parcel-cache', '.turbo',
  '.gradle', 'test-results', 'playwright-report', 'storybook-static',
  // web framework output/caches
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.docusaurus',
  '.angular', '.vite', '.serverless', '.expo',
  // Capacitor `cap sync` copies of www/ into the native shells, and its
  // generated plugin registries — the real source is www/ (or src/)
  'android/app/src/main/assets/public',
  'ios/App/App/public',
  'android/capacitor-cordova-android-plugins',
  'ios/capacitor-cordova-ios-plugins',
  // Cordova generated platform/plugin trees (root-anchored: src/plugins/ is
  // legitimate source in many apps) + runtime shims
  '/platforms', '/plugins', 'cordova.js', 'cordova_plugins.js',
  // Flutter tool cache (web build output lands in build/, covered above)
  '.dart_tool',
  // generated/minified file patterns
  '*.min.js', '*.bundle.js', '*.d.ts', 'workbox-*.js',
];

/**
 * @param {string} root absolute path
 * @param {string[]} extensions e.g. ['.js', '.ts']
 * @returns {string[]} sorted repo-relative paths using '/'
 */
export function walk(root, extensions) {
  const ig = ignoreFactory().add(DEFAULT_IGNORES);
  // .preambleignore loads last: later patterns win, so a repo can both add
  // exclusions (vendored libs .gitignore keeps) and re-include a default
  // with `!pattern`.
  for (const name of ['.gitignore', '.preambleignore']) {
    const file = join(root, name);
    if (existsSync(file)) ig.add(readFileSync(file, 'utf8'));
  }
  const extSet = new Set(extensions);
  const results = [];
  walkDir(root, root, ig, extSet, results);
  return results.sort();
}

function walkDir(root, dir, ig, extSet, results) {
  let dirents;
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    const abs = join(dir, d.name);
    const rel = relative(root, abs).split(sep).join('/');
    if (d.isDirectory()) {
      if (ig.ignores(rel + '/')) continue;
      walkDir(root, abs, ig, extSet, results);
    } else if (d.isFile()) {
      if (ig.ignores(rel)) continue;
      const ext = d.name.slice(d.name.lastIndexOf('.'));
      if (extSet.has(ext)) results.push(rel);
    }
  }
}
