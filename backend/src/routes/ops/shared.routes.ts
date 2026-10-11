import path from 'node:path';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { HttpError } from '../../utils/HttpError';
import { env } from '../../config/env';

export const opsSharedRouter = Router();

opsSharedRouter.use(requireAuth, requireRole('admin', 'sanction'));

opsSharedRouter.get('/:id/salary-slip', async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid loan id');
  const loan = await Loan.findById(req.params.id).select('salarySlip').lean();
  if (!loan?.salarySlip) throw new HttpError(404, 'Salary slip not found');

  const filePath = path.resolve(env.UPLOAD_DIR, path.basename(loan.salarySlip.storedName));
  res.setHeader('Content-Type', loan.salarySlip.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(loan.salarySlip.originalName)}"`);
  res.sendFile(filePath);
});
