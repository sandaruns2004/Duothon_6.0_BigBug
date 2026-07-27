const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// ISO 8583 Message Clearing Simulator for External Financial Ecosystem
// Supports VISA / Mastercard / SWIFT / CEFT / SLIPS interbank remittances
// ═══════════════════════════════════════════════════════════════════

/**
 * Simulates ISO 8583 message clearing for interbank remittances with 99.9% clearing success rate
 */
const simulateISO8583Clearing = ({ amount, currency = 'LKR', network = 'SWIFT', toBankCode = 'INTL', destinationAccount }) => {
  const mtiRequest = '0200'; // Financial Transaction Request
  const stan = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit System Trace Audit Number
  const rrn = String(Math.floor(100000000000 + Math.random() * 900000000000)); // 12-digit Retrieval Reference Number
  const authCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6-char Auth ID

  // 99.9% clearing response rate (0.1% chance of decline/failure)
  const isSuccess = Math.random() < 0.999;
  const responseCode = isSuccess ? '00' : (Math.random() < 0.5 ? '05' : '91');
  const responseMessage = isSuccess
    ? `ISO 8583 Clearing Approved (${network.toUpperCase()}) - Interbank Settlement Confirmed`
    : (responseCode === '05' ? 'Do Not Honor - External Beneficiary Bank Declined' : 'Issuer Switch Inoperative - Clearing Timeout');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const transmissionDateTime = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const isoMessage = {
    mti: '0210', // Financial Transaction Response
    requestMti: mtiRequest,
    processingCode: '000000',
    transactionAmount: Number(amount).toFixed(2),
    currency: currency.toUpperCase(),
    transmissionDateTime,
    stan,
    rrn,
    authCode: isSuccess ? authCode : null,
    responseCode,
    responseMessage,
    network: network.toUpperCase(),
    destinationAccount,
    destinationBank: toBankCode.toUpperCase(),
    clearingTimestamp: now.toISOString()
  };

  if (!isSuccess) {
    logger.warn('⚠️ ISO 8583 clearing decline simulated:', {
      rrn,
      network: isoMessage.network,
      responseCode,
      responseMessage
    });
  } else {
    logger.info('🌐 ISO 8583 clearing approved:', {
      rrn,
      network: isoMessage.network,
      authCode: isoMessage.authCode,
      amount: isoMessage.transactionAmount
    });
  }

  return {
    success: isSuccess,
    iso8583: isoMessage
  };
};

module.exports = {
  simulateISO8583Clearing
};
