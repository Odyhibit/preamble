/**
 * Static delivery: render all entries into one PREAMBLE.md.
 * Layer 1 (orientation): every file with its one-line purpose.
 * Layer 2 (interfaces): the per-file entries.
 */
import { execSync } from 'node:child_process';
import { renderEntry } from './entry.js';

/**
 * @param {import('../extractors/jsts/index.js').Entry[]} entries
 * @param {{root: string}} opts
 * @returns {string} PREAMBLE.md content
 */
export function assemble(entries, { root }) {
  const totalLines = entries.reduce((n, e) => n + e.lines, 0);
  const commit = gitCommit(root);
  const date = new Date().toISOString().slice(0, 10);

  const out = [
    '# PREAMBLE',
    '',
    `> Codebase map for coding agents: interfaces and locations, no implementation.`,
    `> Generated at commit ${commit} on ${date} — ${entries.length} files, ${totalLines.toLocaleString('en-US')} source lines.`,
    `> If this commit is far behind HEAD, regenerate with \`preamble\` before trusting line numbers.`,
    `> Symbol lines end with \`@ L<n>\`; Read the file at that offset instead of searching.`,
    '',
    '## Files',
    '',
  ];
  for (const entry of entries) {
    out.push(`- ${entry.path}${entry.purpose ? ` — ${entry.purpose}` : ''}`);
  }
  out.push('', '---', '');
  for (const entry of entries) {
    out.push(renderEntry(entry), '');
  }
  return out.join('\n');
}

function gitCommit(root) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}
