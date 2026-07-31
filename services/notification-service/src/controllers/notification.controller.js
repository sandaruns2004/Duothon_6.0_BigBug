const { prisma } = require('../config/db');
const { logger } = require('../config/logger');
const { sendHtmlEmail, buildTransactionAlertHtml, buildOtpEmailHtml } = require('../utils/mailer');

// ═══════════════════════════════════════════════════════════════════
// Notification Controller (User Alerts, Read State, Internal Email & Notify)
// ═══════════════════════════════════════════════════════════════════

const getAuthenticatedUserId = (req) => {
  return req.headers['x-user-id'] || (req.user && (req.user.sub || req.user.id)) || null;
};

/**
 * INTERNAL POST /internal/notify
 * Stores DB notification AND sends HTML email alert
 */
const internalNotify = async (req, res) => {
  try {
    const {
      to,
      userId,
      type = 'SYSTEM_ALERT',
      subject,
      title,
      text,
      message,
      html,
      channel = 'EMAIL',
      amount,
      currency = 'LKR',
      referenceNumber,
      status,
      fraudFlag
    } = req.body;

    const notifTitle = title || subject || 'Security Notification';
    const notifMessage = message || text || `Alert from ${type}`;

    let targetUserId = userId ? String(userId) : null;
    if (!targetUserId && to) {
      try {
        const users = await prisma.$queryRawUnsafe(`SELECT id FROM auth_db.users WHERE email = $1 LIMIT 1`, to);
        if (users && users.length > 0) {
          targetUserId = String(users[0].id);
        }
      } catch (e) {
        // ignore schema errors
      }
    }

    // 1. Store DB notification record
    const newNotif = await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: notifTitle,
        message: notifMessage,
        type,
        channel: (channel && String(channel).toUpperCase() === 'PUSH') ? 'PUSH' : 'EMAIL',
        isRead: false
      }
    });

    // 2. Send HTML Email Alert if target email address is provided
    let emailResult = { success: false, reason: 'No destination email provided' };
    if (to) {
      let htmlContent = html;
      if (!htmlContent && (type === 'TRANSACTION_ALERT' || referenceNumber || amount)) {
        htmlContent = buildTransactionAlertHtml({
          amount,
          currency,
          referenceNumber,
          status,
          fraudFlag,
          title: notifTitle,
          message: notifMessage
        });
      }

      emailResult = await sendHtmlEmail({
        to,
        subject: notifTitle,
        html: htmlContent,
        text: notifMessage
      });
    }

    logger.info('🔔 Internal notification processed:', {
      notificationId: newNotif.id,
      to: to || 'DB_ONLY',
      type,
      emailSent: emailResult.success
    });

    return res.status(201).json({
      success: true,
      message: 'Notification stored and alert dispatched.',
      notification: newNotif,
      email: emailResult
    });
  } catch (err) {
    logger.error('Internal notify error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to process internal notification.'
    });
  }
};

/**
 * INTERNAL POST /internal/email
 * Direct OTP or transactional email sender called by Auth Service / internal workers
 */
const internalEmail = async (req, res) => {
  try {
    const { to, subject, text, html, template, otp } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Destination email (to) and subject are required.'
      });
    }

    let htmlContent = html;
    if (template === 'OTP_LOGIN' && otp) {
      htmlContent = buildOtpEmailHtml(otp, subject);
    }

    const emailResult = await sendHtmlEmail({
      to,
      subject,
      text,
      html: htmlContent
    });

    if (!emailResult.success) {
      logger.error('📧 Direct internal email failed to dispatch:', { to, subject });
      return res.status(500).json({
        success: false,
        error: 'Failed to deliver email.'
      });
    }

    logger.info('📧 Direct internal email sent:', {
      to,
      subject,
      success: emailResult.success
    });

    return res.status(200).json({
      success: true,
      message: 'Email dispatched successfully.',
      result: emailResult
    });
  } catch (err) {
    logger.error('Internal email error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to send email.'
    });
  }
};

/**
 * GET /api/notifications
 * List paginated notifications for the authenticated user
 */
const listNotifications = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User ID header missing.'
      });
    }

    const { page = 1, limit = 20, unreadOnly } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      userId: String(userId)
    };

    if (unreadOnly === 'true' || unreadOnly === true) {
      where.isRead = false;
    }

    const [totalCount, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where: { userId: String(userId) } }),
      prisma.notification.count({ where: { userId: String(userId), isRead: false } }),
      prisma.notification.findMany({
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
      unreadCount,
      notifications
    });
  } catch (err) {
    logger.error('List notifications error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications.'
    });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { id } = req.params;

    const notif = await prisma.notification.findFirst({
      where: { id }
    });

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found.'
      });
    }

    // Protect ownership if userId is present
    if (userId && notif.userId && notif.userId !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not own this notification.'
      });
    }

    const updatedNotif = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification: updatedNotif
    });
  } catch (err) {
    logger.error('Mark as read error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification read status.'
    });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all unread notifications for the authenticated user as read
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: String(userId),
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    logger.info('✅ All notifications marked as read for user:', { userId, count: result.count });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      updatedCount: result.count
    });
  } catch (err) {
    logger.error('Mark all as read error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read.'
    });
  }
};

module.exports = {
  internalNotify,
  internalEmail,
  listNotifications,
  markAsRead,
  markAllAsRead
};
