import Quote from '../models/Quote.js';

/**
 * Generate a unique Reference ID in the format SM-XXXX (e.g. SM-7392)
 */
export const generateUniqueReference = async () => {
  let isUnique = false;
  let reference = '';

  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    reference = `SM-${randomDigits}`;

    const existing = await Quote.findOne({ reference });
    if (!existing) {
      isUnique = true;
    }
  }

  return reference;
};
