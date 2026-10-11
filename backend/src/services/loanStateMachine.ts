import { isValidObjectId, type UpdateQuery } from 'mongoose';
import type { LoanStatus } from '../constants';
import { Loan, type ILoan } from '../models/Loan';
import { HttpError } from '../utils/HttpError';

export const TRANSITIONS: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = {
  APPLIED: ['SANCTIONED', 'REJECTED'],
  SANCTIONED: ['DISBURSED'],
  DISBURSED: ['CLOSED'],
  REJECTED: [],
  CLOSED: [],
};

interface TransitionArgs {
  loanId: string;
  from: LoanStatus;
  to: LoanStatus;
  actorId: string;
  note?: string;
  set?: Partial<Pick<ILoan, 'rejectionReason' | 'sanctionedAt' | 'disbursedAt' | 'closedAt'>>;
}

export async function transitionLoan({ loanId, from, to, actorId, note, set = {} }: TransitionArgs) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal transition coded: ${from} → ${to}`);
  }
  if (!isValidObjectId(loanId)) throw new HttpError(400, 'Invalid loan id');

  const update: UpdateQuery<ILoan> = {
    $set: { status: to, ...set },
    $push: { statusHistory: { from, to, by: actorId, at: new Date(), note } },
  };

  const loan = await Loan.findOneAndUpdate({ _id: loanId, status: from }, update, { new: true });

  if (!loan) {
    const current = await Loan.findById(loanId).select('status').lean();
    if (!current) throw new HttpError(404, 'Loan not found');
    throw new HttpError(409, `Loan is ${current.status}; expected ${from}`);
  }
  return loan;
}
