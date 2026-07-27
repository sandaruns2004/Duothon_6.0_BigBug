const { z } = require('zod');

// ═══════════════════════════════════════════════════════════════════
// Zod Validation Schemas for Account Service
// ═══════════════════════════════════════════════════════════════════

const createAccountSchema = z.object({
  accountType: z.enum(['SAVINGS', 'CURRENT', 'BUSINESS']).optional().default('SAVINGS'),
  currency: z.string().optional().default('LKR'),
  initialDeposit: z.union([z.number(), z.string()]).optional().default(0)
});

const executeTransferSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account ID is required'),
  toAccountId: z.string().min(1, 'Destination account ID is required'),
  amount: z.union([z.number().positive(), z.string()]),
  currency: z.string().optional().default('LKR'),
  referenceNumber: z.string().optional()
});

const createLoanSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  amount: z.union([z.number().positive(), z.string()]),
  termMonths: z.union([
    z.number().int().positive('Term must be a positive integer in months'),
    z.string().regex(/^\d+$/, 'Term must be a positive integer in months')
  ]),
  interestRate: z.union([z.number().positive(), z.string()]).optional().default(12.5),
  status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'PAID']).optional()
});

const calculateLoanSchema = z.object({
  amount: z.union([z.number().positive(), z.string()]),
  termMonths: z.union([
    z.number().int().positive('Term must be a positive integer in months'),
    z.string().regex(/^\d+$/, 'Term must be a positive integer in months')
  ]),
  interestRate: z.union([z.number().positive(), z.string()]).optional().default(12.5)
});

const billPaymentSchema = z.object({
  accountId: z.string().min(1, 'Source account ID is required'),
  biller: z.string().min(1, 'Biller name is required (e.g. Electricity, Water, Internet, Mobile)'),
  accountReference: z.string().min(1, 'Account or phone reference number is required'),
  amount: z.union([z.number().positive(), z.string()])
});

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
  createAccountSchema,
  executeTransferSchema,
  createLoanSchema,
  calculateLoanSchema,
  billPaymentSchema,
  validate
};
