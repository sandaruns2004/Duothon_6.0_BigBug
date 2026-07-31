const crypto = require('crypto');
const rabbitmq = require('./rabbitmq');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// MFA OTP Generation, Hashing, Verification & Email Delivery
// ═══════════════════════════════════════════════════════════════════

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
 * Sends MFA Login OTP email via RabbitMQ
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
    await rabbitmq.publishCommand('email.send', {
      to: email,
      subject: 'AegisVault Security: Your Multi-Factor Login OTP',
      text: `Your AegisVault secure login OTP is: ${otp}. This code expires in 5 minutes. Do not share this code with anyone.`,
      template: 'OTP_LOGIN',
      otp: otp
    });

    logger.info('📧 MFA OTP email dispatched successfully via RabbitMQ', { email });
    return true;
  } catch (err) {
    logger.warn('Could not dispatch OTP email via RabbitMQ:', {
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
