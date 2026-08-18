/**
 * CLI: `preamble` (generate, the default), `preamble install-hook`,
 * `preamble snippet`. Flags: --force (ignore cache), --quiet, --root <dir>.
 */
import { generate } from './index.js';
import { executableCommand, installHook } from './hook/post-commit.js';
import { claudeSnippet } from './hook/snippet.js';

const HELP = `preamble — generate PREAMBLE.md, a codebase map for coding agents

usage:
  preamble [generate] [--force] [--quiet] [--root <dir>]
  preamble init [--root <dir>] [--hook] [--force]
  preamble install-hook [--root <dir>]   install git post-commit hook using this preamble executable
  preamble snippet                       print the agent reference snippet
`;

export async function run(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const rootIdx = args.indexOf('--root');
  const root = rootIdx !== -1 && args[rootIdx + 1] ? args[rootIdx + 1] : process.cwd();
  const command = args.find((a) => !a.startsWith('--') && a !== root) ?? 'generate';
  const quiet = flags.has('--quiet');

  if (flags.has('--help') || command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === 'snippet') {
    process.stdout.write(claudeSnippet() + '\n');
    return 0;
  }
  if (command === 'install-hook') {
    const hookPath = installHook(root, { command: executableCommand(argv) });
    if (!quiet) console.log(`Installed post-commit hook: ${hookPath}`);
    return 0;
  }
  if (command === 'init') {
    const t0 = performance.now();
    const { stats, outputPath } = await generate({ root, force: flags.has('--force') });
    let hookPath = null;
    if (flags.has('--hook')) hookPath = installHook(root, { command: executableCommand(argv) });
    if (!quiet) {
      const ms = Math.round(performance.now() - t0);
      console.log(
        `Wrote ${outputPath} — ${stats.files} files (${stats.extracted} extracted, ${stats.cached} cached) in ${ms}ms`
      );
      if (hookPath) console.log(`Installed post-commit hook: ${hookPath}`);
      console.log('\nAgent snippet:\n');
      console.log(claudeSnippet());
    }
    return 0;
  }
  if (command === 'generate') {
    const t0 = performance.now();
    const { stats, outputPath } = await generate({ root, force: flags.has('--force') });
    if (!quiet) {
      const ms = Math.round(performance.now() - t0);
      console.log(
        `Wrote ${outputPath} — ${stats.files} files (${stats.extracted} extracted, ${stats.cached} cached) in ${ms}ms`
      );
      console.log(`Tip: run \`preamble snippet\` for a CLAUDE.md blurb that tells agents to read it.`);
    }
    return 0;
  }
  process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
  return 1;
}
