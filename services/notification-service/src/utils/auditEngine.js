const crypto = require('crypto');
const { prisma } = require('../config/db');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Cryptographic Hash-Chain Audit Engine
// Generates immutable, tamper-evident audit logs with SHA256 chain links
// ═══════════════════════════════════════════════════════════════════

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Records an immutable audit log entry linked to the previous log entry via SHA256 cryptographic hash
 */
const recordAuditEvent = async ({ userId, action, resource, resourceId, ipAddress, details }) => {
  try {
    const timestamp = new Date().toISOString();

    // 1. Retrieve the last audit log record to get its hash as previousHash
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    const prevHash = lastLog ? lastLog.hash : GENESIS_HASH;

    // 2. Normalize details string
    const detailsStr = typeof details === 'object' && details !== null
      ? JSON.stringify(details)
      : String(details || '');

    // 3. Calculate SHA-256 hash = SHA256(prevHash + timestamp + action + userId + details)
    const hashInput = `${prevHash}|${timestamp}|${action}|${userId || 'SYSTEM'}|${detailsStr}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // 4. Store immutable audit record
    const newLog = await prisma.auditLog.create({
      data: {
        userId: userId ? String(userId) : null,
        action,
        resource: resource || null,
        resourceId: resourceId || null,
        ipAddress: ipAddress || null,
        details: detailsStr,
        hash,
        previousHash: prevHash,
        createdAt: new Date(timestamp)
      }
    });

    logger.debug('🛡️ Cryptographic audit record created:', {
      auditId: newLog.id,
      action,
      hash: hash.substring(0, 16) + '...',
      prevHash: prevHash.substring(0, 16) + '...'
    });

    return newLog;
  } catch (err) {
    logger.error('Cryptographic Audit Engine Error:', {
      error: err.message,
      stack: err.stack,
      action
    });
    throw err;
  }
};

/**
 * Verifies the integrity of the entire cryptographic audit log hash chain
 * Returns { valid: boolean, totalRecords: number, brokenAt?: string }
 */
const verifyAuditChain = async () => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' }
    });

    if (logs.length === 0) {
      return { valid: true, totalRecords: 0, message: 'Audit log is empty.' };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (const log of logs) {
      if (log.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          totalRecords: logs.length,
          brokenRecordId: log.id,
          reason: `Previous hash mismatch. Expected ${expectedPrevHash}, found ${log.previousHash}`
        };
      }

      const hashInput = `${log.previousHash}|${log.createdAt.toISOString()}|${log.action}|${log.userId || 'SYSTEM'}|${log.details || ''}`;
      const calculatedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      if (log.hash !== calculatedHash) {
        return {
          valid: false,
          totalRecords: logs.length,
          brokenRecordId: log.id,
          reason: `Hash signature verification failed for record ${log.id}`
        };
      }

      expectedPrevHash = log.hash;
    }

    return {
      valid: true,
      totalRecords: logs.length,
      message: 'All cryptographic hash-chain signatures verified successfully.'
    };
  } catch (err) {
    logger.error('Audit chain verification failed:', { error: err.message });
    throw err;
  }
};

module.exports = {
  recordAuditEvent,
  verifyAuditChain,
  GENESIS_HASH
};
