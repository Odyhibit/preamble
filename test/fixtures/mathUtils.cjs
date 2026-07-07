// checksum math helpers (CommonJS)

/**
 * Weighted sum of transliterated VIN characters.
 * @param {string} vin
 * @param {number[]} weights
 * @returns {number}
 */
exports.weightedSum = function weightedSum(vin, weights) {
  return 0;
};

/** Modulo-11 check digit. */
module.exports.checkDigit = (sum) => '0123456789X'[sum % 11];
