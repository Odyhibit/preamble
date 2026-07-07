/**
 * Extractor registry: the language seam. An extractor declares the file
 * extensions it handles and an async extract(source, path) -> Entry|null.
 * v1 ships JS/TS only; other languages register here without touching core.
 */
import { extract as extractJsTs, EXTENSIONS as JSTS_EXTENSIONS, EXTRACTOR_VERSION as JSTS_VERSION } from './jsts/index.js';

const extractors = [
  { name: 'jsts', extensions: JSTS_EXTENSIONS, version: JSTS_VERSION, extract: extractJsTs },
];

/** All extensions any registered extractor can handle. */
export function allExtensions() {
  return extractors.flatMap((e) => e.extensions);
}

/** @returns {{name: string, version: number, extract: Function}|null} */
export function extractorFor(path) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  return extractors.find((e) => e.extensions.includes(ext)) ?? null;
}
