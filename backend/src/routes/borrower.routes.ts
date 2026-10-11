import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { salarySlipUpload } from '../middleware/upload';
import { User, type IStoredFile } from '../models/User';
import { Loan } from '../models/Loan';
import { ACTIVE_LOAN_STATUSES, EMPLOYMENT_MODES } from '../constants';
import { runBre } from '../services/bre';
import { calculateLoan, INTEREST_RATE_PA, LOAN_LIMITS } from '../services/loanMath';
import { HttpError } from '../utils/HttpError';
import { env } from '../config/env';

export const borrowerRouter = Router();

borrowerRouter.use(requireAuth, requireRole('borrower'));

function publicFile(f?: IStoredFile | null) {
  return f ? { originalName: f.originalName, mimeType: f.mimeType, size: f.size, uploadedAt: f.uploadedAt } : null;
}

async function findActiveLoan(borrowerId: string) {
  return Loan.findOne({ borrower: borrowerId, status: { $in: ACTIVE_LOAN_STATUSES } }).select('_id status').lean();
}

// GET /api/borrower/me
borrowerRouter.get('/me', async (req, res) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) throw new HttpError(404, 'User not found');

  const loans = await Loan.find({ borrower: user._id })
    .select('-salarySlip.storedName -statusHistory')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    profile: user.profile ?? null,
    salarySlip: publicFile(user.salarySlip),
    activeLoan: loans.find((l) => ACTIVE_LOAN_STATUSES.includes(l.status)) ?? null,
    loans,
  });
});

// PUT /api/borrower/profile (Step 2 + BRE)
const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  pan: z.string().trim().toUpperCase().length(10, 'PAN must be 10 characters'),
  dob: z.coerce.date({ invalid_type_error: 'Invalid date of birth' }),
  monthlySalary: z.coerce.number().nonnegative().max(100_000_000),
  employmentMode: z.enum(EMPLOYMENT_MODES),
});

borrowerRouter.put('/profile', async (req, res) => {
  const data = profileSchema.parse(req.body);

  if (await findActiveLoan(req.user!.id)) {
    throw new HttpError(409, 'You already have an active loan; details cannot be changed now');
  }

  const failures = runBre(data);
  if (failures.length > 0) {
    throw new HttpError(422, 'You are not eligible for a loan', failures);
  }

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: { profile: { ...data, verifiedAt: new Date() } } },
    { new: true, runValidators: true },
  ).lean();

  res.json({ profile: user!.profile });
});

// POST /api/borrower/salary-slip (Step 3)
borrowerRouter.post(
  '/salary-slip',
  async (req, _res, next) => {
    const user = await User.findById(req.user!.id).select('profile').lean();
    if (!user?.profile) throw new HttpError(409, 'Complete personal details first');
    if (await findActiveLoan(req.user!.id)) throw new HttpError(409, 'You already have an active loan');
    next();
  },
  salarySlipUpload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name must be "salarySlip")');

    const file: IStoredFile = {
      storedName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    const before = await User.findByIdAndUpdate(req.user!.id, { $set: { salarySlip: file } }).select('salarySlip').lean();
    if (before?.salarySlip) {
      await fs.unlink(path.join(env.UPLOAD_DIR, before.salarySlip.storedName)).catch(() => undefined);
    }

    res.status(201).json({ salarySlip: publicFile(file) });
  },
);

// POST /api/borrower/loans (Step 4: Apply)
const applySchema = z.object({
  amount: z.number().int().min(LOAN_LIMITS.minAmount).max(LOAN_LIMITS.maxAmount),
  tenureDays: z.number().int().min(LOAN_LIMITS.minTenureDays).max(LOAN_LIMITS.maxTenureDays),
});

borrowerRouter.post('/loans', async (req, res) => {
  const { amount, tenureDays } = applySchema.parse(req.body);

  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (!user.profile) throw new HttpError(409, 'Complete personal details first');
  if (!user.salarySlip) throw new HttpError(409, 'Upload your salary slip first');
  if (await findActiveLoan(user.id)) throw new HttpError(409, 'You already have an active loan');

  const failures = runBre(user.profile);
  if (failures.length > 0) throw new HttpError(422, 'You are no longer eligible', failures);

  const quote = calculateLoan(amount, tenureDays);

  const { fullName, pan, dob, monthlySalary, employmentMode } = user.profile;
  const loan = await Loan.create({
    borrower: user._id,
    borrowerSnapshot: { fullName, pan, dob, monthlySalary, employmentMode },
    salarySlip: user.salarySlip,
    ...quote,
    tenureDays,
    interestRate: INTEREST_RATE_PA,
    status: 'APPLIED',
    statusHistory: [{ from: null, to: 'APPLIED', by: user._id, at: new Date(), note: 'Application submitted' }],
  });

  user.salarySlip = undefined;
  await user.save();

  res.status(201).json({ loan });
});
