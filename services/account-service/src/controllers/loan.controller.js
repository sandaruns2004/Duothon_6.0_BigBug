const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { recordLedgerTransaction } = require('../utils/ledger');
const { sendAccountNotification } = require('../utils/notifier');


// ═══════════════════════════════════════════════════════════════════
// Loan Controller (Apply Loan, List Loans, Loan Details, Amortization Schedule)
// ═══════════════════════════════════════════════════════════════════

const getAuthenticatedUserId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || null;
};

/**
 * Helper function to generate a full monthly amortization schedule
 */
const generateAmortizationSchedule = (amount, interestRate, termMonths, monthlyPayment, startDate = new Date()) => {
  const schedule = [];
  let remainingBalance = Number(amount);
  const monthlyRate = (Number(interestRate) / 100) / 12;
  const startDt = new Date(startDate);

  for (let month = 1; month <= termMonths; month++) {
    const beginningBalance = Number(remainingBalance.toFixed(2));
    let interestPayment = Number((beginningBalance * monthlyRate).toFixed(2));
    let principalPayment = Number((Number(monthlyPayment) - interestPayment).toFixed(2));

    if (month === termMonths || principalPayment > beginningBalance) {
      principalPayment = beginningBalance;
    }

    let endingBalance = Number((beginningBalance - principalPayment).toFixed(2));
    if (endingBalance < 0) endingBalance = 0;
    remainingBalance = endingBalance;

    const paymentDate = new Date(startDt);
    paymentDate.setMonth(startDt.getMonth() + month);

    schedule.push({
      installmentNumber: month,
      dueDate: paymentDate.toISOString().split('T')[0],
      beginningBalance,
      monthlyPayment: Number(monthlyPayment),
      principalPayment,
      interestPayment,
      endingBalance,
      status: 'PENDING'
    });

    if (remainingBalance <= 0) break;
  }

  return schedule;
};

/**
 * POST /api/loans/apply
 * Calculates monthly amortization payment and stores loan request in database
 */
const applyLoan = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User ID header missing.'
      });
    }

    const { accountId, accountNumber, amount, termMonths, tenorMonths, interestRate = 12.5, purpose, status } = req.body;
    const targetAccountId = accountId || accountNumber;
    const P = Number(amount);
    const n = Number(termMonths || tenorMonths);
    const rate = Number(interestRate);

    if (isNaN(P) || P <= 0 || isNaN(n) || n <= 0 || isNaN(rate) || rate < 0) {
      return res.status(400).json({
        success: false,
        error: 'Loan amount, termMonths, and interestRate must be valid positive numbers.'
      });
    }

    // Enforce KYC verification prerequisite with informative error message
    try {
      const userRows = await prisma.$queryRawUnsafe(
        "SELECT kyc_status FROM auth_db.users WHERE id = $1",
        String(userId)
      );
      if (userRows && userRows.length > 0) {
        const kycStatus = userRows[0].kyc_status;
        if (kycStatus !== 'VERIFIED') {
          return res.status(403).json({
            success: false,
            error: `Identity verification (KYC) required. Your current KYC status is ${kycStatus || 'UNVERIFIED'}. Please navigate to Profile & KYC to upload your Sri Lankan NIC or Passport and await Admin verification before applying for financing.`,
            kycStatus: kycStatus || 'UNVERIFIED',
            code: 'KYC_NOT_VERIFIED'
          });
        }
      }
    } catch (kycErr) {
      logger.warn('Could not verify KYC status from auth_db:', { error: kycErr.message });
    }

    // Verify target account exists and is active
    const account = await prisma.account.findFirst({
      where: {
        OR: [
          { id: targetAccountId },
          { accountNumber: targetAccountId }
        ]
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found in Account Service.'
      });
    }

    if (account.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: `Account is ${account.status}. Loan application rejected.`
      });
    }

    // Calculate fixed monthly amortization payment
    const monthlyRate = (rate / 100) / 12;
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = P * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    } else {
      monthlyPayment = P / n;
    }
    monthlyPayment = Number(monthlyPayment.toFixed(2));

    const loanStatus = status || 'PENDING';

    // Store loan and increment account balance if approved/active
    const result = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: {
          userId: userId ? String(userId) : account.userId,
          accountId: account.id,
          amount: P,
          interestRate: rate,
          termMonths: n,
          monthlyPayment,
          status: loanStatus
        },
        include: {
          account: {
            select: {
              id: true,
              accountNumber: true,
              accountType: true,
              currency: true,
              balance: true
            }
          }
        }
      });

      if (loanStatus === 'APPROVED' || loanStatus === 'ACTIVE') {
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: P } }
        });
      }

      return newLoan;
    });

    if (loanStatus === 'APPROVED' || loanStatus === 'ACTIVE') {
      recordLedgerTransaction({
        userId,
        fromAccountId: 'AEGISVAULT-FINANCE',
        toAccountId: account.accountNumber,
        amount: P,
        currency: account.currency || 'LKR',
        type: 'DEPOSIT',
        status: 'SUCCESS',
        referenceNumber: `LOAN-DISB-${result.id.slice(0, 8).toUpperCase()}`,
        description: `Loan Disbursement - Personal Financing (Loan #${result.id.slice(0, 8)})`
      });
    }

    const amortizationSchedule = generateAmortizationSchedule(P, rate, n, monthlyPayment, result.createdAt);


    logger.info('💰 Loan application processed successfully:', {
      loanId: result.id,
      accountId: account.id,
      amount: P,
      termMonths: n,
      monthlyPayment,
      status: result.status
    });

    sendAccountNotification({
      userId,
      title: `🏦 Loan Application Submitted: LKR ${P.toLocaleString()}`,
      message: `Your loan application for ${P.toLocaleString()} LKR (${n} months @ ${rate}% APR) is currently ${result.status}.`,
      type: 'TRANSACTION',
      email: req.headers['x-user-email']
    });

    return res.status(201).json({
      success: true,
      message: `Loan application for LKR ${P.toLocaleString()} submitted and ${result.status.toLowerCase()} successfully.`,
      loan: {
        ...result,
        amount: Number(result.amount),
        interestRate: Number(result.interestRate),
        monthlyPayment: Number(result.monthlyPayment),
        paymentStatus: result.status,
        amortizationSchedule
      }
    });
  } catch (err) {
    logger.error('Apply loan error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to process loan application. Please try again later.'
    });
  }
};

/**
 * GET /api/loans
 * Lists all loans for the authenticated user along with their amortization schedule and payment status
 */
const listLoans = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { accountId, status } = req.query;

    const where = {};
    if (userId && !accountId) {
      where.userId = String(userId);
    }
    if (accountId) {
      where.accountId = accountId;
    }
    if (status) {
      where.status = status.toUpperCase();
    }

    const loans = await prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            currency: true
          }
        }
      }
    });

    const formattedLoans = loans.map((loan) => {
      const amountNum = Number(loan.amount);
      const interestRateNum = Number(loan.interestRate);
      const monthlyPaymentNum = Number(loan.monthlyPayment);
      return {
        ...loan,
        amount: amountNum,
        interestRate: interestRateNum,
        monthlyPayment: monthlyPaymentNum,
        paymentStatus: loan.status,
        amortizationSchedule: generateAmortizationSchedule(
          amountNum,
          interestRateNum,
          loan.termMonths,
          monthlyPaymentNum,
          loan.createdAt
        )
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedLoans.length,
      loans: formattedLoans
    });
  } catch (err) {
    logger.error('List loans error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve loans.'
    });
  }
};

/**
 * GET /api/loans/:id
 * Retrieves details for a single loan including amortization schedule and payment status
 */
const getLoan = async (req, res) => {
  try {
    const identifier = req.params.id;

    const loan = await prisma.loan.findFirst({
      where: {
        OR: [
          { id: identifier }
        ]
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            currency: true,
            balance: true,
            status: true
          }
        }
      }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: `Loan not found: ${identifier}`
      });
    }

    const amountNum = Number(loan.amount);
    const interestRateNum = Number(loan.interestRate);
    const monthlyPaymentNum = Number(loan.monthlyPayment);
    const amortizationSchedule = generateAmortizationSchedule(
      amountNum,
      interestRateNum,
      loan.termMonths,
      monthlyPaymentNum,
      loan.createdAt
    );

    return res.status(200).json({
      success: true,
      loan: {
        ...loan,
        amount: amountNum,
        interestRate: interestRateNum,
        monthlyPayment: monthlyPaymentNum,
        paymentStatus: loan.status,
        amortizationSchedule
      }
    });
  } catch (err) {
    logger.error('Get loan error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve loan details.'
    });
  }
};

/**
 * POST /api/loans/calculate
 * Helper endpoint to calculate monthly payment and amortization schedule without storing in DB
 */
const calculateLoan = async (req, res) => {
  try {
    const { amount, termMonths, interestRate = 12.5 } = req.body;
    const P = Number(amount);
    const n = Number(termMonths);
    const rate = Number(interestRate);

    if (isNaN(P) || P <= 0 || isNaN(n) || n <= 0 || isNaN(rate) || rate < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid positive amount and termMonths are required.'
      });
    }

    const monthlyRate = (rate / 100) / 12;
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = P * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    } else {
      monthlyPayment = P / n;
    }
    monthlyPayment = Number(monthlyPayment.toFixed(2));

    const amortizationSchedule = generateAmortizationSchedule(P, rate, n, monthlyPayment, new Date());

    const totalPayment = Number((monthlyPayment * n).toFixed(2));
    const totalInterest = Number((totalPayment - P).toFixed(2));

    return res.status(200).json({
      success: true,
      calculation: {
        principalAmount: P,
        interestRate: rate,
        termMonths: n,
        monthlyPayment,
        totalPayment,
        totalInterest,
        amortizationSchedule
      }
    });
  } catch (err) {
    logger.error('Calculate loan error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate loan amortization.'
    });
  }
};

/**
 * POST /api/loans/:id/pay or /api/loans/pay
 * Executes a monthly EMI installment payment (auto-debit simulation) for a loan
 */
const payInstallment = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const loanId = req.params.id || req.body.loanId;
    const { accountNumber, amount } = req.body;

    let loan = null;
    if (loanId) {
      loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { account: true }
      });
    }

    let account = loan ? loan.account : null;
    if (!loan) {
      // Standalone EMI auto-debit simulation from calculator when no active loan exists yet
      if (accountNumber) {
        account = await prisma.account.findFirst({
          where: { accountNumber: String(accountNumber) }
        });
      }
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Active loan or valid target account not found for installment payment simulation.'
        });
      }
    }

    const paymentAmount = Number(amount || (loan ? loan.monthlyPayment : 0));

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid installment amount.'
      });
    }

    if (Number(account.balance) < paymentAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient account balance for EMI installment deduction.',
        code: 'INSUFFICIENT_FUNDS'
      });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { balance: { decrement: paymentAmount } }
    });

    const refNum = `EMI-${Date.now().toString(36).toUpperCase()}`;

    // Log EMI deduction into the transaction ledger
    recordLedgerTransaction({
      userId: userId ? String(userId) : account.userId,
      fromAccountId: account.accountNumber,
      toAccountId: 'AEGISVAULT-LOAN-REPAY',
      amount: paymentAmount,
      currency: account.currency || 'LKR',
      type: 'PAYMENT',
      referenceNumber: refNum,
      description: loan ? `Loan EMI Deduction - Installment Cut for Loan #${loan.id.slice(0, 8)}` : `Simulated EMI Auto-Debit Installment Deduction`
    });

    logger.info('💸 EMI installment deducted successfully:', {
      loanId: loan ? loan.id : 'SIM-LOAN',
      accountNumber: account.accountNumber,
      amount: paymentAmount,
      referenceNumber: refNum
    });

    sendAccountNotification({
      userId: userId ? String(userId) : account.userId,
      title: `💳 EMI Installment Paid: LKR ${paymentAmount.toLocaleString()}`,
      message: `EMI installment of ${paymentAmount.toLocaleString()} LKR deducted from Account ${account.accountNumber} (Ref: ${refNum}).`,
      type: 'TRANSACTION',
      email: req.headers['x-user-email']
    });

    return res.status(200).json({
      success: true,
      message: `EMI installment of LKR ${paymentAmount.toLocaleString()} deducted successfully.`,
      transaction: {
        referenceNumber: refNum,
        amount: paymentAmount,
        type: 'PAYMENT',
        status: 'SUCCESS',
        description: loan ? `Loan EMI Deduction - Installment Cut for Loan #${loan.id.slice(0, 8)}` : `Simulated EMI Auto-Debit Installment Deduction`
      }
    });
  } catch (err) {
    logger.error('Loan installment payment error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to process EMI installment payment.'
    });
  }
};

/**
 * Admin action: Approve pending loan and credit balance
 */
const approveLoan = async (req, res) => {
  const { id } = req.params;

  try {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { account: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan not found.' });
    }

    if (loan.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `Loan is already in ${loan.status} status.` });
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
      const l = await tx.loan.update({
        where: { id },
        data: { status: 'APPROVED' }
      });

      await tx.account.update({
        where: { id: loan.accountId },
        data: { balance: { increment: loan.amount } }
      });

      return l;
    });

    logger.info('✅ Loan approved and credited to account:', { loanId: id, accountId: loan.accountId, amount: Number(loan.amount) });

    sendAccountNotification({
      userId: loan.userId,
      title: `✅ Loan Approved: LKR ${Number(loan.amount).toLocaleString()}`,
      message: `Your loan for ${Number(loan.amount).toLocaleString()} LKR has been approved by Admin and credited to your account.`,
      type: 'TRANSACTION'
    });

    return res.status(200).json({
      success: true,
      message: 'Loan approved successfully and funds credited to account.',
      loan: updatedLoan
    });
  } catch (err) {
    logger.error('Loan approval error:', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to approve loan.' });
  }
};

module.exports = {
  applyLoan,
  listLoans,
  getLoan,
  calculateLoan,
  payInstallment,
  generateAmortizationSchedule,
  approveLoan
};

