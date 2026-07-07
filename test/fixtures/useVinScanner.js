// ZXing camera VIN scanner hook

import { useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { isVin } from './lib/vinValidate.js';

/**
 * camera lifecycle + continuous decode; auto-stops on valid VIN
 */
export function useVinScanner(videoRef) {
  const [vin, setVin] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const reader = useRef(new BrowserMultiFormatReader());

  function start() {
    setScanning(true);
    reader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      const candidate = normalizeVin(result?.getText() ?? '');
      if (isVin(candidate) && validateChecksum(candidate)) {
        setVin(candidate);
        stop();
      }
    }).catch(setError);
  }

  function stop() {
    setScanning(false);
  }

  return { vin, error, scanning, start, stop };
}

/**
 * ISO 3779 check digit
 * @param {string} vin
 * @returns {boolean}
 */
function validateChecksum(vin) {
  const map = '0123456789X';
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += transliterate(vin[i]) * WEIGHTS[i];
  return map[sum % 11] === vin[8];
}

/** uppercase, strip I/O/Q */
function normalizeVin(raw) {
  return raw.toUpperCase().replace(/[IOQ\s]/g, '');
}

function transliterate(c) {
  return '0123456789.ABCDEFGH..JKLMN.P.R..STUVWXYZ'.indexOf(c) % 10;
}

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
