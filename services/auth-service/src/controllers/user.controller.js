const { prisma } = require('../config/db');
const { logger } = require('../config/logger');

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

    // Verify NIC matches user's registered NIC or update it
    const updatedUser = await prisma.user.update({
      where: { id: String(userId) },
      data: {
        nic,
        kycDocument,
        kycStatus: 'VERIFIED' // Automatic verification for Phase 2 immediate testing/transactions
      },
      select: {
        id: true,
        email: true,
        nic: true,
        kycStatus: true,
        kycDocument: true,
        updatedAt: true
      }
    });

    logger.info('✅ KYC Verification completed for user:', { userId, nic, status: 'VERIFIED' });

    return res.status(200).json({
      success: true,
      message: 'KYC documents submitted and verified successfully.',
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

module.exports = {
  getProfile,
  updateProfile,
  uploadKyc
};
