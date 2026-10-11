import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { transitionLoan } from '../../services/loanStateMachine';

export const disbursementRouter = Router();
disbursementRouter.use(requireAuth, requireRole('admin', 'disbursement'));

disbursementRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'SANCTIONED' })
    .populate('borrower', 'name email')
    .select('-salarySlip.storedName')
    .sort({ sanctionedAt: 1 })
    .lean();
  res.json({ loans });
});

disbursementRouter.patch('/loans/:id/disburse', async (req, res) => {
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'SANCTIONED',
    to: 'DISBURSED',
    actorId: req.user!.id,
    set: { disbursedAt: new Date() },
    note: 'Funds released',
  });
  res.json({ loan });
});
