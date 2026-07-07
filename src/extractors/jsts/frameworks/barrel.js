/**
 * Barrel refiner: an index file that only re-exports owns no interface —
 * record it as a re-export map, not as symbols.
 */

export function refineBarrel(entry) {
  const base = entry.path.slice(entry.path.lastIndexOf('/') + 1);
  entry.barrel = /^index\.[jt]sx?$/.test(base) && entry.reexports.length > 0 && entry.symbols.length === 0;
  if (entry.barrel && !entry.purpose) {
    entry.purpose = `barrel — re-exports from ${entry.reexports.map((r) => r.from).join(', ')}`;
  }
}
