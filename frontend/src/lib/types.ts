export type Role = 'admin' | 'sales' | 'sanction' | 'disbursement' | 'collection' | 'borrower';
export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';
export type EmploymentMode = 'SALARIED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface BorrowerProfile {
  fullName: string;
  pan: string;
  dob: string;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface Loan {
  _id: string;
  borrower: string | { _id: string; name: string; email: string };
  borrowerSnapshot: BorrowerProfile;
  principal: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;
  outstanding?: number;
  status: LoanStatus;
  rejectionReason?: string;
  createdAt: string;
  sanctionedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
}

export interface Payment {
  _id: string;
  utr: string;
  amount: number;
  paidOn: string;
  recordedBy: { _id: string; name: string } | string;
  createdAt: string;
}

export interface BreFailure {
  rule: 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';
  message: string;
}
