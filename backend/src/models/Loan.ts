import { Schema, model, type Types } from 'mongoose';
import { LOAN_STATUSES, ACTIVE_LOAN_STATUSES, EMPLOYMENT_MODES, type LoanStatus, type EmploymentMode } from '../constants';
import { storedFileSchema, type IStoredFile } from './User';

export interface IStatusChange {
  from: LoanStatus | null;
  to: LoanStatus;
  by: Types.ObjectId;
  at: Date;
  note?: string;
}

export interface ILoan {
  _id: Types.ObjectId;
  borrower: Types.ObjectId;

  borrowerSnapshot: {
    fullName: string;
    pan: string;
    dob: Date;
    monthlySalary: number;
    employmentMode: EmploymentMode;
  };
  salarySlip: IStoredFile;

  principal: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;

  status: LoanStatus;
  rejectionReason?: string;
  sanctionedAt?: Date;
  disbursedAt?: Date;
  closedAt?: Date;
  statusHistory: IStatusChange[];

  createdAt: Date;
  updatedAt: Date;
}

const statusChangeSchema = new Schema<IStatusChange>(
  {
    from: { type: String, enum: [...LOAN_STATUSES, null], default: null },
    to: { type: String, enum: LOAN_STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true, default: Date.now },
    note: String,
  },
  { _id: false },
);

const loanSchema = new Schema<ILoan>(
  {
    borrower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    borrowerSnapshot: {
      fullName: { type: String, required: true },
      pan: { type: String, required: true },
      dob: { type: Date, required: true },
      monthlySalary: { type: Number, required: true },
      employmentMode: { type: String, enum: EMPLOYMENT_MODES, required: true },
    },
    salarySlip: { type: storedFileSchema, required: true },
    principal: { type: Number, required: true, min: 0 },
    tenureDays: { type: Number, required: true, min: 1 },
    interestRate: { type: Number, required: true },
    simpleInterest: { type: Number, required: true, min: 0 },
    totalRepayment: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: LOAN_STATUSES, required: true, default: 'APPLIED', index: true },
    rejectionReason: String,
    sanctionedAt: Date,
    disbursedAt: Date,
    closedAt: Date,
    statusHistory: { type: [statusChangeSchema], default: [] },
  },
  { timestamps: true },
);

loanSchema.index(
  { borrower: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_LOAN_STATUSES } }, name: 'one_active_loan_per_borrower' },
);

export const Loan = model<ILoan>('Loan', loanSchema);
