import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { transitionLoan } from '../../services/loanStateMachine';

export const sanctionRouter = Router();
sanctionRouter.use(requireAuth, requireRole('admin', 'sanction'));

// GET /api/ops/sanction/loans
sanctionRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'APPLIED' })
    .populate('borrower', 'name email')
    .select('-salarySlip.storedName')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ loans });
});

// PATCH /api/ops/sanction/loans/:id/approve
sanctionRouter.patch('/loans/:id/approve', async (req, res) => {
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'APPLIED',
    to: 'SANCTIONED',
    actorId: req.user!.id,
    set: { sanctionedAt: new Date() },
    note: 'Approved',
  });
  res.json({ loan });
});

// PATCH /api/ops/sanction/loans/:id/reject
const rejectSchema = z.object({ reason: z.string().trim().min(5, 'Please give a reason (min 5 chars)').max(500) });

sanctionRouter.patch('/loans/:id/reject', async (req, res) => {
  const { reason } = rejectSchema.parse(req.body);
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'APPLIED',
    to: 'REJECTED',
    actorId: req.user!.id,
    set: { rejectionReason: reason },
    note: reason,
  });
  res.json({ loan });
});
