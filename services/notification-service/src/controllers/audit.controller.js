const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { recordAuditEvent, verifyAuditChain } = require('../utils/auditEngine');

// ═══════════════════════════════════════════════════════════════════
// Audit Log Controller (Cryptographic Audit Engine & Admin Viewer)
// ═══════════════════════════════════════════════════════════════════

/**
 * INTERNAL POST /internal/audit
 * Records an immutable audit log entry in the SHA-256 hash chain
 */
const internalAudit = async (req, res) => {
  try {
    const {
      userId,
      user_id,
      action,
      eventType,
      resource,
      service,
      resourceId,
      transactionId,
      ipAddress,
      details,
      ...otherData
    } = req.body;

    const actionName = eventType || action || 'SYSTEM_EVENT';
    const resourceName = resource || service || 'aegisvault-service';
    const resId = resourceId || transactionId || null;
    const userIdentifier = userId || user_id || null;

    // Bundle details cleanly
    let auditDetails = details;
    if (!auditDetails && Object.keys(otherData).length > 0) {
      auditDetails = otherData;
    }

    const auditRecord = await recordAuditEvent({
      userId: userIdentifier,
      action: actionName,
      resource: resourceName,
      resourceId: resId,
      ipAddress: ipAddress || req.ip || null,
      details: auditDetails
    });

    return res.status(201).json({
      success: true,
      message: 'Cryptographic audit log recorded successfully.',
      auditLog: auditRecord
    });
  } catch (err) {
    logger.error('Internal audit error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to record audit log entry.'
    });
  }
};

/**
 * GET /api/audit
 * Searchable, filterable Admin Viewer for the cryptographic audit trail
 */
const listAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      action,
      userId,
      resource,
      resourceId,
      search,
      verifyChain
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Build filter conditions
    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = String(userId);
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };
    if (resourceId) where.resourceId = String(resourceId);

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { hash: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [totalCount, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      })
    ]);

    // Optionally execute mathematical hash-chain verification
    let chainStatus = null;
    if (verifyChain === 'true' || verifyChain === true) {
      chainStatus = await verifyAuditChain();
    }

    return res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      chainVerification: chainStatus,
      auditLogs
    });
  } catch (err) {
    logger.error('List audit logs error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit trail.'
    });
  }
};

/**
 * GET /api/audit/verify-chain
 * Explicit endpoint to verify entire SHA256 cryptographic audit chain integrity
 */
const verifyChainEndpoint = async (req, res) => {
  try {
    const result = await verifyAuditChain();
    const statusCode = result.valid ? 200 : 409;
    return res.status(statusCode).json({
      success: result.valid,
      ...result
    });
  } catch (err) {
    logger.error('Verify chain endpoint error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify cryptographic audit chain.'
    });
  }
};

module.exports = {
  internalAudit,
  listAuditLogs,
  verifyChainEndpoint
};
