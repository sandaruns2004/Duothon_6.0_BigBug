const crypto = require('crypto');
const axios = require('axios');
const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { evaluateFraudRules } = require('../utils/fraudEngine');
const { dispatchAsyncNotifications } = require('../utils/notifier');
const { simulateISO8583Clearing } = require('../utils/iso8583');

// ═══════════════════════════════════════════════════════════════════
// Transaction Controller (Transfer, Balance Pre-Check, Fraud & Receipts)
// ═══════════════════════════════════════════════════════════════════

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://account-service:3002';

const getAuthenticatedUserId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || null;
};

const generateReferenceNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${ts}-${hex}`;
};

/**
 * POST /api/transactions/transfer
 * Orchestrates: Balance Pre-Check -> Fraud Engine -> ACID Account Transfer -> Txn Storage -> Async Alert
 */
const transfer = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { fromAccountId, toAccountId, amount, currency, description } = req.body;
    const numericAmount = Number(amount);

    if (fromAccountId === toAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination accounts must be different.'
      });
    }

    const referenceNumber = generateReferenceNumber();

    // 1. Check sender balance via HTTP GET http://account-service:3002/api/accounts/:id/balance
    try {
      const balanceUrl = `${ACCOUNT_SERVICE_URL}/api/accounts/${fromAccountId}/balance`;
      const balResponse = await axios.get(balanceUrl, { timeout: 3000 });

      if (balResponse.data && balResponse.data.success) {
        const senderBalance = Number(balResponse.data.balance);
        if (senderBalance < numericAmount) {
          return res.status(400).json({
            success: false,
            error: 'Insufficient funds in source account for this transfer.',
            code: 'INSUFFICIENT_FUNDS'
          });
        }
      }
    } catch (balErr) {
      if (balErr.response && balErr.response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Source account not found in Account Service.'
        });
      }
      logger.warn('Account balance pre-check HTTP call failed:', {
        error: balErr.message,
        fromAccountId
      });
      // Continue to execute-transfer if balance check timed out; Account Service ACID check will protect
    }

    // 2. Execute Rule-Based Fraud Detection Engine
    const fraudEvaluation = await evaluateFraudRules({
      fromAccountId,
      toAccountId,
      amount: numericAmount
    });

    // 3. Call Account Service POST http://account-service:3002/api/accounts/execute-transfer
    let transferResult;
    try {
      const transferUrl = `${ACCOUNT_SERVICE_URL}/api/accounts/execute-transfer`;
      const execResponse = await axios.post(transferUrl, {
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        currency: currency || 'LKR',
        referenceNumber
      }, { timeout: 5000 });

      transferResult = execResponse.data;
    } catch (execErr) {
      const resp = execErr.response;
      logger.warn('Account Service execute-transfer failed:', {
        status: resp ? resp.status : 'NO_RESPONSE',
        error: resp ? resp.data : execErr.message
      });

      return res.status(resp ? resp.status : 502).json({
        success: false,
        error: (resp && resp.data && resp.data.error) || 'Fund transfer execution failed in Account Service.',
        code: (resp && resp.data && resp.data.code) || 'TRANSFER_EXECUTION_FAILED'
      });
    }

    // 4. Save transaction record in txn_schema.transactions
    const newTransaction = await prisma.transaction.create({
      data: {
        userId: userId ? String(userId) : null,
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        currency: currency || 'LKR',
        type: 'TRANSFER',
        status: fraudEvaluation.isFlagged ? 'FLAGGED' : 'SUCCESS',
        referenceNumber,
        fraudFlag: fraudEvaluation.isFlagged,
        description: description || 'Digital banking fund transfer'
      }
    });

    // 5. Persist triggered FraudAlert records if transaction was flagged
    if (fraudEvaluation.triggeredRules.length > 0) {
      for (const ruleItem of fraudEvaluation.triggeredRules) {
        await prisma.fraudAlert.create({
          data: {
            transactionId: newTransaction.id,
            ruleTriggered: ruleItem.rule,
            riskScore: ruleItem.riskScore,
            status: 'FLAGGED'
          }
        });
      }
    }

    // 6. Dispatch async fire-and-forget alert to Notification Service (/internal/notify and /internal/audit)
    dispatchAsyncNotifications({
      transaction: newTransaction,
      fraudEvaluation,
      userEmail: req.headers['x-user-email']
    });

    logger.info('💸 Transaction processed successfully:', {
      transactionId: newTransaction.id,
      referenceNumber,
      amount: numericAmount,
      status: newTransaction.status,
      fraudFlag: newTransaction.fraudFlag
    });

    return res.status(201).json({
      success: true,
      message: fraudEvaluation.isFlagged
        ? 'Transfer executed and flagged for security review due to fraud detection rules.'
        : 'Fund transfer completed successfully.',
      transaction: newTransaction,
      transferDetails: transferResult ? transferResult.transfer : null,
      fraudAlerts: fraudEvaluation.triggeredRules
    });
  } catch (err) {
    logger.error('Transfer execution controller error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while processing the transaction.'
    });
  }
};

/**
 * GET /api/transactions
 * Paginated transaction history with type/date filters
 */
const listTransactions = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate,
      accountId
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (userId && !accountId) {
      where.userId = String(userId);
    }
    if (accountId) {
      where.OR = [
        { fromAccountId: accountId },
        { toAccountId: accountId }
      ];
    }
    if (type) {
      where.type = type.toUpperCase();
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          fraudAlerts: true
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      transactions
    });
  } catch (err) {
    logger.error('List transactions error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve transactions.'
    });
  }
};

/**
 * GET /api/transactions/:id
 * Retrieve details for a single transaction by ID or reference number
 */
const getTransaction = async (req, res) => {
  try {
    const identifier = req.params.id;

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: identifier },
          { referenceNumber: identifier }
        ]
      },
      include: {
        fraudAlerts: true
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction not found: ${identifier}`
      });
    }

    return res.status(200).json({
      success: true,
      transaction
    });
  } catch (err) {
    logger.error('Get transaction error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction details.'
    });
  }
};

/**
 * GET /api/transactions/:id/receipt
 * Formatted transaction receipt for customer download or print
 */
const getReceipt = async (req, res) => {
  try {
    const identifier = req.params.id;

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: identifier },
          { referenceNumber: identifier }
        ]
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction not found: ${identifier}`
      });
    }

    const receipt = {
      receiptId: `RCP-${transaction.referenceNumber}`,
      referenceNumber: transaction.referenceNumber,
      executedAt: transaction.createdAt,
      type: transaction.type,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      status: transaction.status,
      fraudFlag: transaction.fraudFlag,
      description: transaction.description || 'N/A',
      platform: 'AegisVault Digital Banking'
    };

    return res.status(200).json({
      success: true,
      receipt
    });
  } catch (err) {
    logger.error('Get receipt error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to generate transaction receipt.'
    });
  }
};

/**
 * POST /api/transactions/external-transfer
 * Simulates ISO 8583 message clearing for VISA / Mastercard / SWIFT interbank remittances
 */
const externalTransfer = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const userEmail = req.headers['x-user-email'] || 'customer@aegisvault.com';
    const {
      fromAccountId,
      toExternalAccount,
      toAccountId,
      toBankCode = 'SWIFT-INTL',
      network = 'SWIFT',
      amount,
      currency = 'LKR',
      description
    } = req.body;

    const destinationAccount = toExternalAccount || toAccountId;
    const numericAmount = Number(amount);
    const referenceNumber = generateReferenceNumber();

    // 1. Balance Pre-Check via Account Service
    try {
      const balUrl = `${ACCOUNT_SERVICE_URL}/api/accounts/${fromAccountId}/balance`;
      const balResponse = await axios.get(balUrl, { timeout: 3000 });
      const { balance, status } = balResponse.data;

      if (status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: `Source account is ${status}. Transfer rejected.`
        });
      }

      if (Number(balance) < numericAmount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient funds in source account for external remittance.',
          code: 'INSUFFICIENT_FUNDS'
        });
      }
    } catch (err) {
      const resp = err.response;
      logger.warn('Account Service balance check failed for external transfer:', {
        error: resp ? resp.data : err.message
      });

      return res.status(resp ? resp.status : 502).json({
        success: false,
        error: (resp && resp.data && resp.data.error) || 'Failed to verify account status with Account Service.',
        code: (resp && resp.data && resp.data.code) || 'ACCOUNT_SERVICE_UNREACHABLE'
      });
    }

    // 2. Real-time Fraud Rule Evaluation
    const fraudEvaluation = await evaluateFraudRules({
      fromAccountId,
      toAccountId: destinationAccount,
      amount: numericAmount
    });

    // 3. Simulate ISO 8583 Message Clearing (VISA / Mastercard / SWIFT / CEFT / SLIPS)
    const clearingResult = simulateISO8583Clearing({
      amount: numericAmount,
      currency,
      network,
      toBankCode,
      destinationAccount
    });

    if (!clearingResult.success) {
      return res.status(422).json({
        success: false,
        error: `External clearing declined: ${clearingResult.iso8583.responseMessage}`,
        code: 'EXTERNAL_CLEARING_DECLINED',
        iso8583: clearingResult.iso8583
      });
    }

    // 4. Debit Sender in Account Service
    try {
      const debitUrl = `${ACCOUNT_SERVICE_URL}/api/accounts/debit`;
      await axios.post(
        debitUrl,
        {
          accountId: fromAccountId,
          amount: numericAmount,
          description: description || `External remittance via ${network.toUpperCase()} to ${destinationAccount}`,
          referenceNumber
        },
        { timeout: 5000 }
      );
    } catch (debitErr) {
      const resp = debitErr.response;
      logger.warn('Account Service debit failed during external transfer:', {
        status: resp ? resp.status : 'NO_RESPONSE',
        error: resp ? resp.data : debitErr.message
      });

      return res.status(resp ? resp.status : 502).json({
        success: false,
        error: (resp && resp.data && resp.data.error) || 'Fund transfer debit failed in Account Service.',
        code: (resp && resp.data && resp.data.code) || 'DEBIT_EXECUTION_FAILED'
      });
    }

    // 5. Store Transaction Record
    const record = await prisma.$transaction(async (tx) => {
      const newTxn = await tx.transaction.create({
        data: {
          userId: userId ? String(userId) : null,
          fromAccountId,
          toAccountId: destinationAccount,
          amount: numericAmount,
          currency: currency || 'LKR',
          type: 'TRANSFER',
          status: fraudEvaluation.isFlagged ? 'FLAGGED' : 'SUCCESS',
          referenceNumber,
          fraudFlag: fraudEvaluation.isFlagged,
          description: description || `ISO 8583 ${network.toUpperCase()} remittance to ${destinationAccount} (${toBankCode})`
        }
      });

      if (fraudEvaluation.isFlagged) {
        await Promise.all(
          fraudEvaluation.triggeredRules.map((ruleItem) =>
            tx.fraudAlert.create({
              data: {
                transactionId: newTxn.id,
                ruleTriggered: ruleItem.rule,
                riskScore: ruleItem.riskScore,
                status: 'FLAGGED'
              }
            })
          )
        );
      }

      return newTxn;
    });

    // 6. Async Fire-and-Forget Notification & Audit Trail
    dispatchAsyncNotifications({ transaction: record, fraudEvaluation, userEmail });

    logger.info('🌐 External remittance cleared and completed:', {
      referenceNumber,
      fromAccountId,
      destinationAccount,
      network: clearingResult.iso8583.network,
      amount: numericAmount,
      rrn: clearingResult.iso8583.rrn
    });

    return res.status(201).json({
      success: true,
      message: `External transfer of LKR ${numericAmount.toLocaleString()} via ${network.toUpperCase()} cleared and processed successfully.`,
      transaction: record,
      iso8583: clearingResult.iso8583,
      fraudEvaluation
    });
  } catch (err) {
    logger.error('External transfer orchestration error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'External remittance processing failed. Please try again later.',
      code: 'EXTERNAL_TRANSFER_ERROR'
    });
  }
};

module.exports = {
  transfer,
  externalTransfer,
  listTransactions,
  getTransaction,
  getReceipt
};
