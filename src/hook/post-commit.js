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

const HOOK_BODY = `#!/bin/sh
# preamble: regenerate PREAMBLE.md (content-hash cached; only changed files re-extract)
npx --no-install preamble generate --quiet || true
`;

const MARKER = '# preamble:';

export function installHook(root) {
  const hooksDir = join(root, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    throw new Error(`no .git/hooks directory under ${root} — is this a git repository?`);
  }
  const hookPath = join(hooksDir, 'post-commit');
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current.includes(MARKER)) return hookPath; // already installed
    // Append to an existing hook rather than clobbering it.
    writeFileSync(hookPath, current.trimEnd() + '\n\n' + HOOK_BODY.split('\n').slice(1).join('\n'));
  } else {
    writeFileSync(hookPath, HOOK_BODY);
  }
  chmodSync(hookPath, 0o755);
  return hookPath;
}
