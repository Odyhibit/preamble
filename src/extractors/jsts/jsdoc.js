/**
 * JSDoc parsing: descriptions and (for plain JS) param/return types.
 * Rule: never invent. Missing or empty doc -> empty strings / nulls.
 */

/**
 * Parse a JSDoc comment's text (including the comment markers).
 * @returns {{desc: string, params: Map<string, string>, returns: string|null, tags: Set<string>}}
 */
export function parseJsdoc(commentText) {
  const result = { desc: '', params: new Map(), returns: null, tags: new Set() };
  if (!commentText || !commentText.startsWith('/**')) return result;

  const lines = commentText
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').trimEnd());

  const descLines = [];
  for (const line of lines) {
    const tag = line.match(/^@(\w+)\b\s*(.*)$/);
    if (!tag) {
      if (descLines.length === 0 && line.trim() === '') continue;
      descLines.push(line);
      continue;
    }
    result.tags.add(tag[1]);
    const rest = tag[2];
    if (tag[1] === 'param' || tag[1] === 'arg' || tag[1] === 'argument') {
      // @param {type} name - description   (type optional, braces may nest)
      const type = rest.startsWith('{') ? bracedType(rest) : null;
      const after = type === null ? rest : rest.slice(type.length + 2).trimStart();
      const m = after.match(/^\[?([\w$.]+)/);
      if (m) result.params.set(m[1], (type ?? '').trim());
    } else if (tag[1] === 'returns' || tag[1] === 'return') {
      const type = rest.startsWith('{') ? bracedType(rest) : null;
      if (type) result.returns = type.trim();
    } else if ((tag[1] === 'file' || tag[1] === 'fileoverview' || tag[1] === 'module') && rest.trim() && descLines.length === 0) {
      descLines.push(rest.trim());
    }
  }

  // First sentence only; the map is dense by design.
  result.desc = firstSentence(descLines.join('\n'));
  return result;
}

/** Contents of a balanced {...} at the start of text, or null. Types nest: {{a: {b}}}. */
function bracedType(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(1, i);
  }
  return null;
}

/**
 * First sentence of the first paragraph, with wrapped lines rejoined.
 * Comments wrap mid-sentence; cutting at the first raw line truncates them.
 */
export function firstSentence(text) {
  if (!text) return '';
  const para = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) {
      if (para.length) break;
      continue;
    }
    para.push(t);
  }
  let s = para.join(' ');
  const end = s.match(/^.*?[.!?](?=\s|$)/);
  if (end) s = end[0];
  return s.length > 120 ? s.slice(0, 119) + '…' : s;
}

/**
 * Extract a one-line description from any leading comment (JSDoc or //).
 * Used for the file-purpose line.
 */
export function commentFirstLine(commentText) {
  if (!commentText) return '';
  if (commentText.startsWith('/**')) return parseJsdoc(commentText).desc;
  if (commentText.startsWith('/*')) {
    return firstSentence(commentText.replace(/^\/\*+/, '').replace(/\*+\/$/, '').replace(/^\s*\*\s?/gm, ''));
  }
  if (commentText.startsWith('//')) return firstSentence(commentText.replace(/^\/\/+\s?/, ''));
  return '';
}
