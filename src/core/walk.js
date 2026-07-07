/**
 * File discovery: enumerate extractable source files under a root, honoring
 * the root .gitignore plus built-in ignores. Returns repo-relative POSIX paths.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ignoreFactory from 'ignore';

// Always ignored regardless of .gitignore: generated/vendored trees and our own output.
const DEFAULT_IGNORES = [
  '.git', 'node_modules', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.output', '.cache', '.preamble', '.claude',
  '*.min.js', '*.bundle.js', '*.d.ts', 'vendor',
];

/**
 * @param {string} root absolute path
 * @param {string[]} extensions e.g. ['.js', '.ts']
 * @returns {string[]} sorted repo-relative paths using '/'
 */
export function walk(root, extensions) {
  const ig = ignoreFactory().add(DEFAULT_IGNORES);
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
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
