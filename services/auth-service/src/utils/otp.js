const crypto = require('crypto');
const axios = require('axios');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// MFA OTP Generation, Hashing, Verification & Email Delivery
// ═══════════════════════════════════════════════════════════════════

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';

/**
 * Generates a random numeric OTP of specified length (default 6 digits)
 */
const generateNumericOtp = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return String(num);
};

/**
 * Creates a deterministic SHA-256 hex hash of the OTP string for secure caching
 */
const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
};

/**
 * Verifies if an OTP string matches a stored SHA-256 hash in constant time
 */
const verifyOtpHash = (otp, hash) => {
  const generatedHash = hashOtp(otp);
  if (generatedHash.length !== hash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hash));
};

/**
 * Sends MFA Login OTP email via Notification Service with resilient fallback
 */
const sendOtpEmail = async (email, otp) => {
  // Always log OTP in non-production environments for automated testing & demos
  if (process.env.NODE_ENV !== 'production') {
    logger.info('🔐 [DEMO / DEV MODE] MFA Login OTP generated:', {
      email,
      otp,
      expiresIn: '5 minutes'
    });
  }

  try {
    const url = `${NOTIFICATION_SERVICE_URL}/api/notifications/email`;
    await axios.post(url, {
      to: email,
      subject: 'AegisVault Security: Your Multi-Factor Login OTP',
      text: `Your AegisVault secure login OTP is: ${otp}. This code expires in 5 minutes. Do not share this code with anyone.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1e293b; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">
          <h2 style="color: #38bdf8;">AegisVault Security Verification</h2>
          <p>Please use the one-time verification code below to complete your login:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #1e293b; color: #38bdf8; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 14px;">This code is valid for <strong>5 minutes</strong>. If you did not initiate this login, please contact AegisVault Security immediately.</p>
        </div>
      `
    }, {
      timeout: 3000
    });

    logger.info('📧 MFA OTP email dispatched successfully via Notification Service', { email });
    return true;
  } catch (err) {
    logger.warn('Could not reach Notification Service to send OTP email (running in degraded notification mode):', {
      error: err.message,
      email
    });
    return false;
  }
};

module.exports = {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  sendOtpEmail
};
