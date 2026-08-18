/**
 * Git post-commit hook installer. The hook regenerates PREAMBLE.md through
 * the cache, so only files changed by the commit are re-extracted.
 *
 * Tradeoff (documented, deliberate): post-commit means PREAMBLE.md updates
 * land in the *next* commit. A pre-commit hook could `git add` the fresh map
 * into the same commit, but hooks that mutate the index surprise people and
 * fight with partial staging — post-commit is the safe default the brief asked
 * for. The map header's commit hash is the staleness tripwire either way.
 */
import { writeFileSync, existsSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOCK_START = '# preamble: begin managed block';
const BLOCK_END = '# preamble: end managed block';

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function executableCommand(argv = process.argv) {
  if (!argv[1]) return 'preamble';
  return `${shellQuote(process.execPath)} ${shellQuote(argv[1])}`;
}

export function hookBody(command = 'preamble') {
  return `${BLOCK_START}
# Regenerate PREAMBLE.md through the central preamble install.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
${command} generate --quiet --root "$PWD" || true
${BLOCK_END}
`;
}

function fullHook(command) {
  return `#!/bin/sh
${hookBody(command)}`;
}

function upsertManagedBlock(current, command) {
  const next = hookBody(command).trimEnd();
  const blockPattern = new RegExp(`${escapeRegExp(BLOCK_START)}[\\s\\S]*?${escapeRegExp(BLOCK_END)}`);
  if (blockPattern.test(current)) return current.replace(blockPattern, next);

  const legacyPattern =
    /\n?# preamble: regenerate PREAMBLE\.md \(content-hash cached; only changed files re-extract\)\nnpx --no-install preamble generate --quiet \|\| true\n?/;
  if (legacyPattern.test(current)) return current.replace(legacyPattern, `\n${next}\n`);

  return `${current.trimEnd()}\n\n${next}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function installHook(root, { command = 'preamble' } = {}) {
  const hooksDir = join(root, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    throw new Error(`no .git/hooks directory under ${root} — is this a git repository?`);
  }
  const hookPath = join(hooksDir, 'post-commit');
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    // Append to an existing hook rather than clobbering it; replace our own
    // managed block when reinstalling.
    writeFileSync(hookPath, upsertManagedBlock(current, command));
  } else {
    writeFileSync(hookPath, fullHook(command));
  }
  chmodSync(hookPath, 0o755);
  return hookPath;
}
