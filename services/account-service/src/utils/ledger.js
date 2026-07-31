const { logger } = require('../config/logger');

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:3003';

/**
 * Asynchronously records a transaction in the transaction-service ledger via HTTP POST
 */
const recordLedgerTransaction = async (txnData) => {
  try {
    if (typeof fetch === 'function') {
      const response = await fetch(`${TRANSACTION_SERVICE_URL}/api/transactions/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(txnData.userId ? { 'x-user-id': String(txnData.userId) } : {})
        },
        body: JSON.stringify(txnData)
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn('Failed to record transaction in ledger:', { status: response.status, errText });
        return null;
      }

      const data = await response.json();
      return data;
    }
  } catch (err) {
    logger.warn('Error connecting to transaction-service ledger:', { error: err.message });
    return null;
  }
};

module.exports = {
  recordLedgerTransaction
};
