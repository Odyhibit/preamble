/** The CLAUDE.md blurb that tells agents the map exists and how to use it. */

export function claudeSnippet() {
  return `## Codebase map

Read \`PREAMBLE.md\` before exploring. It maps every source file to its purpose,
public/internal symbols with signatures, and line numbers (\`@ L42\`) — use a
targeted Read with that offset instead of grep/glob exploration. If its header
commit is stale, regenerate with \`npx preamble\`.`;
}
