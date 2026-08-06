const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { generateAccountNumber, generateReceiptNumber } = require('../utils/accountGenerator');
const { recordLedgerTransaction } = require('../utils/ledger');
const { sendAccountNotification } = require('../utils/notifier');


// ═══════════════════════════════════════════════════════════════════
// Account Controller (Create Account, List, Balance Check & ACID Transfers)
// ═══════════════════════════════════════════════════════════════════

const getAuthenticatedUserId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || null;
};

/**
 * POST /api/accounts
 * Creates a new bank account with auto-generated 12-digit account number and initial deposit
 */
const createAccount = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User ID header missing.'
      });
    }

    const { accountType, currency, initialDeposit } = req.body;
    const accountNumber = await generateAccountNumber();

    const newAccount = await prisma.account.create({
      data: {
        userId: String(userId),
        accountNumber,
        accountType: accountType || 'SAVINGS',
        balance: Number(initialDeposit || 0),
        currency: currency || 'LKR',
        status: 'ACTIVE'
      }
    });

    logger.info('🏦 New bank account created:', {
      accountId: newAccount.id,
      accountNumber: newAccount.accountNumber,
      accountType: newAccount.accountType,
      userId
    });

    return res.status(201).json({
      success: true,
      message: 'Bank account created successfully.',
      account: newAccount
    });
  } catch (err) {
    logger.error('Create account error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to create bank account. Please try again later.'
    });
  }
};

/**
 * GET /api/accounts
 * Lists all bank accounts owned by the authenticated user
 */
const listAccounts = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    let accounts = await prisma.account.findMany({
      where: { userId: String(userId) },
      orderBy: { createdAt: 'asc' }
    });

    if (accounts.length === 0) {
      const accountNumber = await generateAccountNumber();
      const newAccount = await prisma.account.create({
        data: {
          userId: String(userId),
          accountNumber,
          accountType: 'SAVINGS',
          balance: 500000.00,
          currency: 'LKR',
          status: 'ACTIVE'
        }
      });
      accounts = [newAccount];
      logger.info('🏦 Auto-provisioned initial savings account for user:', { userId, accountNumber });
    }

    return res.status(200).json({
      success: true,
      count: accounts.length,
      accounts
    });
  } catch (err) {
    logger.error('List accounts error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve accounts.'
    });
  }
};

/**
 * GET /api/accounts/:id/balance
 * Real-time balance check for internal/external queries (lookup by UUID or Account Number)
 */
const getBalance = async (req, res) => {
  try {
    const accountIdentifier = req.params.id;

    const account = await prisma.account.findFirst({
      where: {
        OR: [
          { id: accountIdentifier },
          { accountNumber: accountIdentifier }
        ]
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: `Account not found: ${accountIdentifier}`
      });
    }

    return res.status(200).json({
      success: true,
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      balance: Number(account.balance),
      currency: account.currency,
      status: account.status
    });
  } catch (err) {
    logger.error('Get balance error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve account balance.'
    });
  }
};

/**
 * POST /api/accounts/execute-transfer
 * Executes atomic ACID SQL transaction (BEGIN -> Debit Sender -> Credit Receiver -> COMMIT)
 * Automatic rollback if sender has insufficient funds
 */
const executeTransfer = async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, currency, referenceNumber } = req.body;

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Transfer amount must be a positive number.'
      });
    }

    // Execute atomic SQL transaction via Prisma
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock & fetch sender account
      const sender = await tx.account.findFirst({
        where: {
          OR: [
            { id: fromAccountId },
            { accountNumber: fromAccountId }
          ]
        }
      });

      if (!sender) {
        const error = new Error('Source account does not exist.');
        error.code = 'SENDER_NOT_FOUND';
        throw error;
      }

      if (sender.status !== 'ACTIVE') {
        const error = new Error(`Source account is ${sender.status}. Transfer rejected.`);
        error.code = 'SENDER_INACTIVE';
        throw error;
      }

      // 2. ACID Fund Sufficiency Verification
      const senderBalance = Number(sender.balance);
      if (senderBalance < transferAmount) {
        const error = new Error('Insufficient funds in source account for this transfer.');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      // 3. Lock & fetch receiver account
      const receiver = await tx.account.findFirst({
        where: {
          OR: [
            { id: toAccountId },
            { accountNumber: toAccountId }
          ]
        }
      });

      if (!receiver) {
        const error = new Error('Destination account does not exist.');
        error.code = 'RECEIVER_NOT_FOUND';
        throw error;
      }

      if (receiver.status !== 'ACTIVE') {
        const error = new Error(`Destination account is ${receiver.status}. Transfer rejected.`);
        error.code = 'RECEIVER_INACTIVE';
        throw error;
      }

      if (sender.id === receiver.id) {
        const error = new Error('Cannot transfer funds to the same account.');
        error.code = 'SAME_ACCOUNT';
        throw error;
      }

      // 4. Atomic Debit Sender with Conditional Check
      const senderUpdateResult = await tx.account.updateMany({
        where: { 
          id: sender.id,
          balance: { gte: transferAmount }
        },
        data: {
          balance: { decrement: transferAmount }
        }
      });

      if (senderUpdateResult.count === 0) {
        const error = new Error('Insufficient funds in source account for this transfer (Balance changed).');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      // 5. Atomic Credit Receiver
      await tx.account.update({
        where: { id: receiver.id },
        data: { balance: { increment: transferAmount } }
      });

      // Re-fetch accurate balances after atomic updates
      const updatedSender = await tx.account.findUnique({ where: { id: sender.id } });
      const updatedReceiver = await tx.account.findUnique({ where: { id: receiver.id } });

      return {
        sender: updatedSender,
        receiver: updatedReceiver
      };
    });

    logger.info('💸 ACID transfer executed successfully:', {
      fromAccount: result.sender.accountNumber,
      toAccount: result.receiver.accountNumber,
      amount: transferAmount,
      currency: currency || 'LKR',
      referenceNumber
    });

    return res.status(200).json({
      success: true,
      message: 'ACID fund transfer completed atomically.',
      transfer: {
        fromAccountId: result.sender.id,
        fromAccountNumber: result.sender.accountNumber,
        fromUserId: result.sender.userId,
        newSenderBalance: Number(result.sender.balance),
        toAccountId: result.receiver.id,
        toAccountNumber: result.receiver.accountNumber,
        toUserId: result.receiver.userId,
        newReceiverBalance: Number(result.receiver.balance),
        amount: transferAmount,
        currency: currency || 'LKR',
        referenceNumber,
        executedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.warn('ACID transfer transaction rolled back:', {
      error: err.message,
      code: err.code
    });

    if (err.code === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'INSUFFICIENT_FUNDS'
      });
    }

    if (
      err.code === 'SENDER_NOT_FOUND' ||
      err.code === 'RECEIVER_NOT_FOUND' ||
      err.code === 'SENDER_INACTIVE' ||
      err.code === 'RECEIVER_INACTIVE' ||
      err.code === 'SAME_ACCOUNT'
    ) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }

    return res.status(500).json({
      success: false,
      error: 'An unexpected database error occurred during transfer execution. Transaction rolled back.'
    });
  }
};

/**
/**
 * POST /api/payments/bill
 * Executes utility bill payment by debiting account balance & issuing a UtilityReceipt
 */
const payBill = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const {
      accountId,
      accountNumber,
      biller,
      billerId,
      accountReference,
      amount,
      referenceNumber
    } = req.body;

    const targetAccountId = accountId || accountNumber;
    const targetBiller = biller || billerId || 'CEB';
    const targetReference = accountReference || accountNumber || 'N/A';
    const targetRefNumber = referenceNumber || generateReceiptNumber();
    const paymentAmount = Number(amount);

    if (!targetAccountId || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account identifier or payment amount.'
      });
    }

    let sourceAccountNumber = null;

    const receipt = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          OR: [
            { id: String(targetAccountId) },
            { accountNumber: String(targetAccountId) }
          ]
        }
      });

      if (!account || account.status !== 'ACTIVE') {
        const error = new Error('Account not found or inactive.');
        error.code = 'INVALID_ACCOUNT';
        throw error;
      }

      sourceAccountNumber = account.accountNumber;

      if (Number(account.balance) < paymentAmount) {
        const error = new Error('Insufficient funds in account for utility bill payment.');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      // Atomic Debit with Condition
      const debitResult = await tx.account.updateMany({
        where: { 
          id: account.id,
          balance: { gte: paymentAmount }
        },
        data: { balance: { decrement: paymentAmount } }
      });

      if (debitResult.count === 0) {
        const error = new Error('Insufficient funds in account for utility bill payment (Balance changed).');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      // Generate receipt
      const newReceipt = await tx.utilityReceipt.create({
        data: {
          userId: userId ? String(userId) : account.userId,
          accountId: account.id,
          biller: targetBiller,
          accountReference: targetReference,
          amount: paymentAmount,
          receiptNumber: targetRefNumber,
          status: 'PAID'
        }
      });

      return newReceipt;
    });

    // Automatically record payment in transaction ledger for unified history & fraud check
    await recordLedgerTransaction({
      userId,
      email: req.headers['x-user-email'],
      fromAccountId: sourceAccountNumber || String(targetAccountId),
      toAccountId: `${targetBiller}-BILLER`,
      amount: paymentAmount,
      currency: 'LKR',
      type: 'PAYMENT',
      status: 'SUCCESS',
      referenceNumber: receipt.receiptNumber,
      description: `${targetBiller} Utility / Reload Payment (Ref: ${targetReference})`
    });

    logger.info('💡 Utility bill payment executed successfully:', {
      receiptNumber: receipt.receiptNumber,
      biller: receipt.biller,
      amount: paymentAmount
    });

    sendAccountNotification({
      userId,
      title: `💡 Utility Bill Paid: LKR ${paymentAmount.toLocaleString()}`,
      message: `Paid ${paymentAmount.toLocaleString()} LKR to ${targetBiller} (Ref: ${targetReference}). Receipt: ${receipt.receiptNumber}`,
      type: 'TRANSACTION',
      email: req.headers['x-user-email']
    });

    return res.status(201).json({
      success: true,
      message: `${targetBiller} payment of LKR ${paymentAmount.toLocaleString()} completed successfully.`,
      receipt,
      transaction: {
        referenceNumber: receipt.receiptNumber,
        amount: paymentAmount,
        type: 'PAYMENT',
        status: 'SUCCESS'
      }
    });
  } catch (err) {
    logger.warn('Utility bill payment rolled back:', { error: err.message, code: err.code });
    if (err.code === 'INSUFFICIENT_FUNDS' || err.code === 'INVALID_ACCOUNT') {
      return res.status(400).json({ success: false, error: err.message, code: err.code });
    }
    return res.status(500).json({ success: false, error: 'Bill payment processing failed.' });
  }
};

/**
 * POST /api/accounts/debit
 * Debits an account balance for external transfers, withdrawals, or clearing
 */
const debitAccount = async (req, res) => {
  try {
    const { accountId, amount, description, referenceNumber } = req.body;
    const debitAmount = Number(amount);

    if (isNaN(debitAmount) || debitAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Debit amount must be a positive number.' });
    }

    const updatedAccount = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          OR: [
            { id: accountId },
            { accountNumber: accountId }
          ]
        }
      });

      if (!account || account.status !== 'ACTIVE') {
        const error = new Error('Account not found or inactive.');
        error.code = 'INVALID_ACCOUNT';
        throw error;
      }

      if (Number(account.balance) < debitAmount) {
        const error = new Error('Insufficient funds in account.');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      const debitResult = await tx.account.updateMany({
        where: { 
          id: account.id,
          balance: { gte: debitAmount }
        },
        data: { balance: { decrement: debitAmount } }
      });

      if (debitResult.count === 0) {
        const error = new Error('Insufficient funds in account (Balance changed).');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }

      return await tx.account.findUnique({ where: { id: account.id } });
    });

    logger.info('💸 Account debited successfully:', {
      accountId: updatedAccount.id,
      amount: debitAmount,
      referenceNumber
    });

    return res.status(200).json({
      success: true,
      message: 'Account debited successfully.',
      account: {
        id: updatedAccount.id,
        accountNumber: updatedAccount.accountNumber,
        newBalance: Number(updatedAccount.balance)
      }
    });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FUNDS' || err.code === 'INVALID_ACCOUNT') {
      return res.status(400).json({ success: false, error: err.message, code: err.code });
    }
    logger.error('Debit account error:', { error: err.message });
    return res.status(500).json({ success: false, error: 'Account debit failed.' });
  }
};

/**
 * POST /api/accounts/credit
 * Credits an account balance for external deposits, settlements, or clearing
 */
const creditAccount = async (req, res) => {
  try {
    const { accountId, amount, description, referenceNumber } = req.body;
    const creditAmount = Number(amount);

    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Credit amount must be a positive number.' });
    }

    const updatedAccount = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: {
          OR: [
            { id: accountId },
            { accountNumber: accountId }
          ]
        }
      });

      if (!account || account.status !== 'ACTIVE') {
        const error = new Error('Account not found or inactive.');
        error.code = 'INVALID_ACCOUNT';
        throw error;
      }

      return await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: creditAmount } }
      });
    });

    logger.info('💰 Account credited successfully:', {
      accountId: updatedAccount.id,
      amount: creditAmount,
      referenceNumber
    });

    return res.status(200).json({
      success: true,
      message: 'Account credited successfully.',
      account: {
        id: updatedAccount.id,
        accountNumber: updatedAccount.accountNumber,
        newBalance: Number(updatedAccount.balance)
      }
    });
  } catch (err) {
    if (err.code === 'INVALID_ACCOUNT') {
      return res.status(400).json({ success: false, error: err.message, code: err.code });
    }
    logger.error('Credit account error:', { error: err.message });
    return res.status(500).json({ success: false, error: 'Account credit failed.' });
  }
};

module.exports = {
  createAccount,
  listAccounts,
  getBalance,
  executeTransfer,
  payBill,
  debitAccount,
  creditAccount
};
