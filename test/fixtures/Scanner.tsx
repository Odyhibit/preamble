import { useVinScanner } from './useVinScanner.js';

export interface ScannerProps {
  onScan: (vin: string) => void;
  timeoutMs?: number;
  overlay: React.ReactNode;
}

export type ScanState = 'idle' | 'scanning' | 'done';

/** Camera viewport with VIN overlay; wraps useVinScanner. */
export default function Scanner({ onScan, timeoutMs = 5000, overlay }: ScannerProps) {
  return null;
}

/** Small inline status chip. */
export function StatusChip({ state }: { state: ScanState }) {
  return null;
}

// junk types must be omitted, never propagated
export function logEvent(payload: any, meta: {}): void {
  console.log(payload, meta);
}
