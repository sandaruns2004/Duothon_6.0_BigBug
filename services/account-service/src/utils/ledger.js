const { logger } = require('../config/logger');

const getTransactionServiceUrls = () => {
  const urls = [
    process.env.TRANSACTION_SERVICE_URL,
    'http://transaction-service:3003',
    'http://localhost:3003',
    'http://127.0.0.1:3003'
  ];
  return Array.from(new Set(urls.filter(Boolean)));
};

/**
 * Asynchronously records a transaction in the transaction-service ledger via HTTP POST
 * Tries fallback URLs if network or host resolution fails (supporting Docker and local Windows execution)
 */
const recordLedgerTransaction = async (txnData) => {
  if (typeof fetch !== 'function') return null;

  const urls = getTransactionServiceUrls();
  let lastError = null;

  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/transactions/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(txnData.userId ? { 'x-user-id': String(txnData.userId) } : {}),
          ...(txnData.email ? { 'x-user-email': String(txnData.email) } : {})
        },
        body: JSON.stringify(txnData)
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn('Failed to record transaction in ledger:', { baseUrl, status: response.status, errText });
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      lastError = err;
      // Continue to next fallback URL if network error (ENOTFOUND, ECONNREFUSED, etc.)
    }
  }

  logger.warn('Error connecting to transaction-service ledger across all fallback URLs:', { error: lastError ? lastError.message : 'Unknown error' });
  return null;
};

module.exports = {
  recordLedgerTransaction
};
