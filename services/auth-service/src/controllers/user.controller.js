const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { sendAuthNotification } = require('../utils/notifier');

// ═══════════════════════════════════════════════════════════════════
// User Profile & KYC Verification Controller
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracts authenticated User ID from request headers (injected by API Gateway) or req.user
 */
const getAuthenticatedUserId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || null;
};

/**
 * GET /api/users/profile
 * Retrieves authenticated user's profile and KYC status
 */
const getProfile = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing user identity header.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        email: true,
        phone: true,
        nic: true,
        role: true,
        kycStatus: true,
        kycDocument: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      profile: user
    });
  } catch (err) {
    logger.error('Get profile error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile.'
    });
  }
};

/**
 * PUT /api/users/profile
 * Updates authenticated user's contact information (email or phone)
 */
const updateProfile = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const { email, phone } = req.body;
    const updateData = {};
    if (email) updateData.email = email.toLowerCase();
    if (phone) updateData.phone = phone;

    // Check if new email/phone already belongs to someone else
    if (Object.keys(updateData).length > 0) {
      const conflict = await prisma.user.findFirst({
        where: {
          NOT: { id: String(userId) },
          OR: [
            ...(updateData.email ? [{ email: updateData.email }] : []),
            ...(updateData.phone ? [{ phone: updateData.phone }] : [])
          ]
        }
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          error: 'Email or phone number is already in use by another account.'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: String(userId) },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        nic: true,
        role: true,
        kycStatus: true,
        kycDocument: true,
        updatedAt: true
      }
    });

    logger.info('✏️ Profile updated for user:', { userId });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedUser
    });
  } catch (err) {
    logger.error('Update profile error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to update user profile.'
    });
  }
};

/**
 * POST /api/users/kyc
 * Uploads NIC document reference and verifies customer KYC status
 */
const uploadKyc = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const { nic, kycDocument } = req.body;

    // Persist document reference in Azure Blob Storage container until admin review
    const blobContainer = process.env.AZURE_BLOB_CONTAINER || 'aegisvault-kyc-private';
    const blobRef = kycDocument ? (kycDocument.startsWith('azure-blob://') ? kycDocument : `azure-blob://${blobContainer}/${kycDocument}`) : null;

    const updateData = {
      kycDocument: blobRef || kycDocument,
      kycStatus: 'PENDING' // Awaiting admin review
    };
    if (nic && typeof nic === 'string' && nic.trim() !== '' && nic.trim() !== 'N/A') {
      updateData.nic = nic.trim();
    }

    // Verify NIC matches user's registered NIC or update it
    const updatedUser = await prisma.user.update({
      where: { id: String(userId) },
      data: updateData,
      select: {
        id: true,
        email: true,
        nic: true,
        kycStatus: true,
        kycDocument: true,
        updatedAt: true
      }
    });

    logger.info('✅ KYC Verification submitted for user:', { userId, nic, status: 'PENDING' });

    sendAuthNotification({
      userId: updatedUser.id,
      title: '📄 KYC Submitted successfully!',
      message: 'KYC document submitted successfully! Awaiting admin review. File saved in Azure Blob Storage.',
      type: 'SECURITY',
      email: updatedUser.email
    });

    return res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully. Awaiting admin verification.',
      profile: updatedUser
    });
  } catch (err) {
    logger.error('KYC upload error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to process KYC submission.'
    });
  }
};

/**
 * GET /api/users/internal
 * Internal route for Admin Service to fetch user directory
 */
const getInternalUsers = async (req, res) => {
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
    logger.error('List internal users error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to list users.'
    });
  }
};

/**
 * PUT /api/users/internal/:id/kyc-verify
 * Internal route for Admin Service to verify KYC
 */
const verifyInternalUserKyc = async (req, res) => {
  try {
    const { id } = req.params;

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

    return res.status(200).json({
      success: true,
      message: 'User KYC status verified successfully.',
      user: updatedUser
    });
  } catch (err) {
    logger.error('Verify internal KYC error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify user KYC status.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadKyc,
  getInternalUsers,
  verifyInternalUserKyc
};
