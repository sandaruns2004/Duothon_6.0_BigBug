const { prisma } = require('../config/db');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Admin Controller (Dashboard Aggregation, User Governance, KYC Verification)
// ═══════════════════════════════════════════════════════════════════

const getAuthenticatedAdminId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || 'SYSTEM_ADMIN';
};

/**
 * GET /api/admin/dashboard
 * Aggregates real-time platform metrics across Auth, Account, and Transaction databases
 */
const getDashboard = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      kycPendingUsers,
      activeAccounts,
      totalTransactionsToday,
      flaggedTransactionsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      prisma.account.count({ where: { status: 'ACTIVE' } }),
      prisma.transaction.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.transaction.count({ where: { fraudFlag: true } })
    ]);

    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    // Asynchronously record snapshot metric
    setImmediate(async () => {
      try {
        await prisma.systemMetric.createMany({
          data: [
            { metricName: 'total_users', metricValue: totalUsers },
            { metricName: 'active_accounts', metricValue: activeAccounts },
            { metricName: 'transactions_today', metricValue: totalTransactionsToday }
          ]
        });
      } catch (e) {
        logger.debug('System metric snapshot write skip:', { error: e.message });
      }
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      dashboard: {
        totalUsers,
        kycPendingUsers,
        activeAccounts,
        totalTransactionsToday,
        flaggedTransactionsCount,
        uptime: uptimeSeconds,
        uptimeFormatted
      }
    });
  } catch (err) {
    logger.error('Dashboard aggregation error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to aggregate admin dashboard metrics.'
    });
  }
};

/**
 * GET /api/admin/users
 * Lists users with search, pagination, and role/status filters
 */
const listUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      kycStatus,
      isLocked
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (role) where.role = role.toUpperCase();
    if (kycStatus) where.kycStatus = kycStatus.toUpperCase();
    if (isLocked !== undefined) where.isLocked = isLocked === 'true' || isLocked === true;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { nic: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          email: true,
          phone: true,
          nic: true,
          role: true,
          kycStatus: true,
          kycDocument: true,
          failedAttempts: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true
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
      users
    });
  } catch (err) {
    logger.error('List users error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to list users.'
    });
  }
};

/**
 * PUT /api/admin/users/:id/suspend
 * Suspends (locks) a user account and records an admin audit action
 */
const suspendUser = async (req, res) => {
  try {
    const adminId = getAuthenticatedAdminId(req);
    const { id } = req.params;
    const { reason = 'Administrative suspension' } = req.body;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isLocked: true },
      select: {
        id: true,
        email: true,
        role: true,
        isLocked: true,
        kycStatus: true,
        updatedAt: true
      }
    });

    // Record Admin Action
    await prisma.adminAction.create({
      data: {
        adminUserId: String(adminId),
        action: 'SUSPEND_USER',
        targetUserId: id,
        reason
      }
    });

    logger.warn('🚨 User account suspended by admin:', { adminId, targetUserId: id, reason });

    return res.status(200).json({
      success: true,
      message: 'User account suspended successfully.',
      user: updatedUser
    });
  } catch (err) {
    logger.error('Suspend user error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to suspend user account.'
    });
  }
};

/**
 * PUT /api/admin/users/:id/verify
 * Verifies user KYC status and records an admin audit action
 */
const verifyUserKyc = async (req, res) => {
  try {
    const adminId = getAuthenticatedAdminId(req);
    const { id } = req.params;
    const { reason = 'KYC document verification approved by administrative officer' } = req.body;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { kycStatus: 'VERIFIED' },
      select: {
        id: true,
        email: true,
        role: true,
        isLocked: true,
        kycStatus: true,
        updatedAt: true
      }
    });

    // Record Admin Action
    await prisma.adminAction.create({
      data: {
        adminUserId: String(adminId),
        action: 'VERIFY_USER_KYC',
        targetUserId: id,
        reason
      }
    });

    logger.info('✅ User KYC verified by admin:', { adminId, targetUserId: id });

    return res.status(200).json({
      success: true,
      message: 'User KYC status verified successfully.',
      user: updatedUser
    });
  } catch (err) {
    logger.error('Verify KYC error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify user KYC status.'
    });
  }
};

/**
 * PUT /api/admin/users/:id/unlock
 * Unlocks a suspended or lockout user account
 */
const unlockUser = async (req, res) => {
  try {
    const adminId = getAuthenticatedAdminId(req);
    const { id } = req.params;
    const { reason = 'Account unlocked by administrative officer' } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isLocked: false,
        failedAttempts: 0
      },
      select: {
        id: true,
        email: true,
        role: true,
        isLocked: true,
        failedAttempts: true,
        updatedAt: true
      }
    });

    await prisma.adminAction.create({
      data: {
        adminUserId: String(adminId),
        action: 'UNLOCK_USER',
        targetUserId: id,
        reason
      }
    });

    return res.status(200).json({
      success: true,
      message: 'User account unlocked successfully.',
      user: updatedUser
    });
  } catch (err) {
    logger.error('Unlock user error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to unlock user account.'
    });
  }
};

/**
 * GET /api/admin/fraud-alerts
 * Lists all flagged transactions from Transaction Service with pagination and filtering
 */
const listFraudAlerts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      fraudFlag: true
    };

    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { fromAccountId: { contains: search, mode: 'insensitive' } },
        { toAccountId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalCount, alerts] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
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
      alerts
    });
  } catch (err) {
    logger.error('List fraud alerts error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud alerts.'
    });
  }
};

module.exports = {
  getDashboard,
  listUsers,
  suspendUser,
  verifyUserKyc,
  unlockUser,
  listFraudAlerts
};

