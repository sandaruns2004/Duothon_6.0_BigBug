const { z } = require('zod');

// ═══════════════════════════════════════════════════════════════════
// Zod Validation Schemas for Auth Service & KYC
// ═══════════════════════════════════════════════════════════════════

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registerSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits'),
  nic: z.string().min(8, 'NIC must be at least 8 characters long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      passwordRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  role: z.enum(['CUSTOMER', 'ADMIN', 'OFFICER']).optional().default('CUSTOMER')
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required')
});

const verifyOtpSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const updateProfileSchema = z.object({
  email: z.string().email('Please provide a valid email address').optional(),
  phone: z.string().min(9, 'Phone number must be at least 9 digits').optional()
});

const kycUploadSchema = z.object({
  nic: z.string().min(8, 'NIC must be at least 8 characters long'),
  kycDocument: z.string().min(1, 'KYC document reference is required')
});

/**
 * Express Middleware factory to validate request body against a Zod schema
 */
const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fieldErrors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: fieldErrors
      });
    }
    next(err);
  }
};

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  updateProfileSchema,
  kycUploadSchema,
  validate
};
