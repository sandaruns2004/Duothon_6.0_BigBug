const crypto = require('crypto');
const { prisma } = require('../config/db');

// ═══════════════════════════════════════════════════════════════════
// Unique 12-Digit Account Number & Receipt Number Generator
// ═══════════════════════════════════════════════════════════════════

/**
 * Generates a unique 12-digit numeric account number using crypto random int
 */
const generateAccountNumber = async () => {
  let isUnique = false;
  let accountNumber = '';

  while (!isUnique) {
    // Generate 12-digit string starting with standard Sri Lankan bank prefix "102"
    const prefix = '102';
    const randomDigits = String(crypto.randomInt(100000000, 999999999)); // 9 digits
    accountNumber = `${prefix}${randomDigits}`;

    // Check collision against database
    const existing = await prisma.account.findUnique({
      where: { accountNumber }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return accountNumber;
};

/**
 * Generates a unique utility bill payment receipt number
 */
const generateReceiptNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `UB-${timestamp}-${randomSuffix}`;
};

module.exports = {
  generateAccountNumber,
  generateReceiptNumber
};
