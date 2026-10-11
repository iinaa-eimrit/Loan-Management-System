import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { User } from '../../models/User';

export const salesRouter = Router();
salesRouter.use(requireAuth, requireRole('admin', 'sales'));

salesRouter.get('/leads', async (_req, res) => {
  const leads = await User.aggregate([
    { $match: { role: 'borrower' } },
    {
      $lookup: {
        from: 'loans',
        let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$borrower', '$$uid'] } } }, { $limit: 1 }, { $project: { _id: 1 } }],
        as: 'loans',
      },
    },
    { $match: { loans: { $size: 0 } } },
    {
      $project: {
        name: 1,
        email: 1,
        createdAt: 1,
        fullName: '$profile.fullName',
        monthlySalary: '$profile.monthlySalary',
        profileCompleted: { $ne: [{ $type: '$profile' }, 'missing'] },
        salarySlipUploaded: { $ne: [{ $type: '$salarySlip' }, 'missing'] },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  res.json({ leads });
});
