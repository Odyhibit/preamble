/** Shared VIN domain types. */

export interface DecodedVin {
  vin: string;
  make: string;
  model: string;
  year: number;
}

export type VinResult = { ok: true; decoded: DecodedVin } | { ok: false; error: string };

export enum Region {
  NorthAmerica,
  Europe,
  Asia,
}

const REGION_PREFIXES = { NorthAmerica: '1-5', Europe: 'S-Z', Asia: 'J-R' };
