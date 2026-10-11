import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { Payment } from '../../models/Payment';
import { transitionLoan } from '../../services/loanStateMachine';
import { HttpError } from '../../utils/HttpError';

export const collectionRouter = Router();
collectionRouter.use(requireAuth, requireRole('admin', 'collection'));

function assertId(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(400, 'Invalid loan id');
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// GET /api/ops/collection/loans
collectionRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'DISBURSED' })
    .populate('borrower', 'name email')
    .select('-salarySlip.storedName')
    .sort({ disbursedAt: 1 })
    .lean();

  res.json({ loans: loans.map((l) => ({ ...l, outstanding: l.totalRepayment - l.amountPaid })) });
});

// GET /api/ops/collection/loans/:id/payments
collectionRouter.get('/loans/:id/payments', async (req, res) => {
  assertId(req.params.id);
  if (!(await Loan.exists({ _id: req.params.id }))) throw new HttpError(404, 'Loan not found');
  const payments = await Payment.find({ loan: req.params.id })
    .populate('recordedBy', 'name')
    .sort({ paidOn: -1, createdAt: -1 })
    .lean();
  res.json({ payments });
});

// POST /api/ops/collection/loans/:id/payments
const paymentSchema = z.object({
  utr: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{12,22}$/, 'UTR must be 12–22 letters/digits'),
  amount: z.coerce.number().positive('Amount must be greater than 0')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Max 2 decimal places'),
  paidOn: z.coerce.date(),
});

collectionRouter.post('/loans/:id/payments', async (req, res) => {
  const loanId = req.params.id;
  assertId(loanId);
  const body = paymentSchema.parse(req.body);
  const amount = Math.round(body.amount * 100);

  // 1. Validate against current loan state
  const loan = await Loan.findById(loanId);
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (loan.status !== 'DISBURSED') {
    throw new HttpError(409, `Payments can only be recorded on DISBURSED loans (this one is ${loan.status})`);
  }

  const outstanding = loan.totalRepayment - loan.amountPaid;
  if (amount > outstanding) {
    throw new HttpError(400, `Amount exceeds outstanding balance of ₹${(outstanding / 100).toFixed(2)}`);
  }
  if (body.paidOn > new Date()) throw new HttpError(400, 'Payment date cannot be in the future');
  if (loan.disbursedAt && body.paidOn < startOfUtcDay(loan.disbursedAt)) {
    throw new HttpError(400, 'Payment date cannot be before the disbursement date');
  }

  // 2. Insert the payment
  const payment = await Payment.create({
    loan: loan._id,
    utr: body.utr,
    amount,
    paidOn: body.paidOn,
    recordedBy: req.user!.id,
  });

  // 3. Atomically add to amountPaid
  const updated = await Loan.findOneAndUpdate(
    {
      _id: loan._id,
      status: 'DISBURSED',
      $expr: { $lte: [{ $add: ['$amountPaid', amount] }, '$totalRepayment'] },
    },
    { $inc: { amountPaid: amount } },
    { new: true },
  );

  if (!updated) {
    await Payment.deleteOne({ _id: payment._id });
    throw new HttpError(409, 'Loan balance changed while recording; payment would exceed outstanding. Refresh and retry.');
  }

  // 4. Auto-close when fully repaid
  let finalLoan = updated;
  if (updated.amountPaid === updated.totalRepayment) {
    finalLoan = await transitionLoan({
      loanId: String(updated._id),
      from: 'DISBURSED',
      to: 'CLOSED',
      actorId: req.user!.id,
      set: { closedAt: new Date() },
      note: 'Auto-closed: fully repaid',
    });
  }

  res.status(201).json({
    payment,
    loan: finalLoan,
    outstanding: finalLoan.totalRepayment - finalLoan.amountPaid,
    closed: finalLoan.status === 'CLOSED',
  });
});
