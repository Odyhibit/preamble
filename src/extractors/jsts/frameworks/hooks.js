/**
 * Hook refiner: for use* functions the RETURN SHAPE is the interface.
 * Only replaces the return when the source didn't already state one (TS
 * return type or JSDoc @returns wins — never override the author).
 */
import { inferReturnShape } from '../signatures.js';

export function refineHooks(entry) {
  for (const sym of entry.symbols) {
    if (sym.kind !== 'function' || !/^use[A-Z]/.test(sym.name)) continue;
    sym.kind = 'hook';
    if (!sym.returns && sym._node) {
      sym.returns = inferReturnShape(sym._node);
    }
  }
}
