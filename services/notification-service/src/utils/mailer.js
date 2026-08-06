const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Nodemailer HTML Email Sender (Mailtrap Sandbox / Gmail SMTP / Mock Fallback)
// ═══════════════════════════════════════════════════════════════════

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = Number(process.env.SMTP_PORT || 2525);
const SMTP_USER = process.env.SMTP_USER || 'test_smtp_user';
const SMTP_PASS = process.env.SMTP_PASS || 'test_smtp_password';
const SMTP_FROM = process.env.SMTP_FROM || 'AegisVault Security <no-reply@aegisvault.com>';

/**
 * Configure Nodemailer Transport
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

/**
 * Core function to send HTML email with Nodemailer
 * Includes automatic mock delivery logging if SMTP transport is unreachable or in sandbox mode
 */
const sendHtmlEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject,
    text: text || subject,
    html: html || `<p>${text || subject}</p>`
  };

  // Always log email dispatch in development/test environments for demo verification
  if (SMTP_USER === 'test_smtp_user' && SMTP_HOST === 'smtp.mailtrap.io') {
    logger.info('📧 [DEV / SANDBOX EMAIL DISPATCH] Simulating email delivery instantly (mock mode):', {
      to,
      subject,
      bodyPreview: (text || html || '').substring(0, 150), // Include a preview so the developer can see the OTP!
      simulated: true
    });
    return {
      success: true,
      messageId: `MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      simulated: true
    };
  }

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ HTML Email sent successfully via SMTP:', {
      messageId: info.messageId,
      to,
      subject
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.warn('SMTP Transport failed:', {
      error: err.message,
      to,
      subject,
      bodyPreview: (text || html || '').substring(0, 150)
    });
    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * Builds HTML template for OTP / MFA Verification Email
 */
const buildOtpEmailHtml = (otp, subject = 'AegisVault: Your Login Verification Code') => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #0369a1; margin: 0;">AegisVault</h1>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0;">Digital Banking Platform</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h2 style="color: #0f172a; font-size: 20px;">${subject}</h2>
      <p style="color: #334155;">Please use the one-time verification code below to authorize your session:</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; background-color: #f1f5f9; color: #0369a1; padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This verification code expires in <strong>5 minutes</strong>. If you did not initiate this action, please contact AegisVault Support immediately to secure your account.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} AegisVault. All rights reserved.</p>
    </div>
  `;
};

/**
 * Builds HTML template for Transaction Alert Email
 */
const buildTransactionAlertHtml = ({ amount, currency = 'LKR', referenceNumber, status, fraudFlag, title, message }) => {
  const statusColor = fraudFlag ? '#f59e0b' : status === 'SUCCESS' ? '#10b981' : '#ef4444';
  const formattedAmount = Number(amount || 0).toLocaleString();

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #0369a1; margin: 0;">AegisVault</h1>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0;">Transaction Notification</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h2 style="color: #0f172a; font-size: 20px;">${title || 'Transaction Alert'}</h2>
      <p style="color: #334155;">${message || 'A transaction was processed on your AegisVault account:'}</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid ${statusColor}; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 4px 0; color: #64748b; font-size: 13px;">AMOUNT</p>
        <p style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; color: #0f172a;">${currency} ${formattedAmount}</p>
        
        <p style="margin: 4px 0; color: #64748b; font-size: 13px;">REFERENCE NUMBER</p>
        <p style="margin: 0 0 12px 0; font-size: 14px; font-family: monospace; color: #0369a1;">${referenceNumber || 'N/A'}</p>
        
        <p style="margin: 4px 0; color: #64748b; font-size: 13px;">STATUS</p>
        <p style="margin: 0; font-size: 14px; font-weight: bold; color: ${statusColor};">${fraudFlag ? 'FLAGGED (REVIEW)' : status || 'COMPLETED'}</p>
      </div>

      <p style="color: #64748b; font-size: 14px;">If you do not recognize this transaction, please log in and lock your account.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} AegisVault. All rights reserved.</p>
    </div>
  `;
};

module.exports = {
  sendHtmlEmail,
  buildOtpEmailHtml,
  buildTransactionAlertHtml
};
