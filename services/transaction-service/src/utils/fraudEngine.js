const { prisma } = require('../config/db');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Rule-Based Fraud Detection Engine for AegisVault
// ═══════════════════════════════════════════════════════════════════

/**
 * Evaluates a proposed transfer against 3 real-time fraud detection rules:
 * Rule 1: High transfer amount (amount > 500,000 LKR -> flag)
 * Rule 2: High velocity (> 3 transfers within 10 minutes -> flag)
 * Rule 3: Large transfer to new recipient (amount > 100,000 LKR to new account -> flag)
 */
const evaluateFraudRules = async ({ fromAccountId, toAccountId, amount }) => {
  const triggeredRules = [];
  const numericAmount = Number(amount);

  try {
    // 1. Rule 1: High Transfer Amount (> 500,000 LKR)
    if (numericAmount > 500000) {
      triggeredRules.push({
        rule: 'RULE_1_HIGH_AMOUNT',
        riskScore: 40,
        description: `High transfer amount: LKR ${numericAmount.toLocaleString()} exceeds 500,000 LKR threshold`
      });
    }

    // 2. Rule 2: High Transaction Velocity (> 3 transfers within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTransfersCount = await prisma.transaction.count({
      where: {
        fromAccountId,
        createdAt: { gte: tenMinutesAgo }
      }
    });

    if (recentTransfersCount >= 3) {
      triggeredRules.push({
        rule: 'RULE_2_HIGH_VELOCITY',
        riskScore: 35,
        description: `High transaction velocity: ${recentTransfersCount} transfers executed within the last 10 minutes`
      });
    }

    // 3. Rule 3: Large Transfer to New Recipient (> 100,000 LKR to never-before-credited recipient)
    if (numericAmount > 100000) {
      const priorTransfer = await prisma.transaction.findFirst({
        where: {
          fromAccountId,
          toAccountId,
          status: 'SUCCESS'
        }
      });

      if (!priorTransfer) {
        triggeredRules.push({
          rule: 'RULE_3_NEW_RECIPIENT_LARGE_AMOUNT',
          riskScore: 25,
          description: `Large transfer to new recipient: LKR ${numericAmount.toLocaleString()} to account without prior transaction history`
        });
      }
    }

    const totalRiskScore = triggeredRules.reduce((sum, item) => sum + item.riskScore, 0);
    const isFlagged = triggeredRules.length > 0;

    if (isFlagged) {
      logger.warn('🚨 Fraud Detection Engine triggered alerts:', {
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        totalRiskScore,
        rules: triggeredRules.map((r) => r.rule)
      });
    }

    return {
      isFlagged,
      totalRiskScore,
      triggeredRules
    };
  } catch (err) {
    logger.error('Error during fraud rule evaluation:', { error: err.message, stack: err.stack });
    // Fail safe: return unflagged if engine query errors so transactions aren't blocked by DB timeout
    return {
      isFlagged: false,
      totalRiskScore: 0,
      triggeredRules: []
    };
  }
};

module.exports = {
  evaluateFraudRules
};
