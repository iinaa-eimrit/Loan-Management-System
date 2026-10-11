export const ROLES = ['admin', 'sales', 'sanction', 'disbursement', 'collection', 'borrower'] as const;
export type Role = (typeof ROLES)[number];

export const LOAN_STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

// A borrower can have at most one loan in these states at a time.
export const ACTIVE_LOAN_STATUSES: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED'];

export const EMPLOYMENT_MODES = ['SALARIED', 'SELF_EMPLOYED', 'UNEMPLOYED'] as const;
export type EmploymentMode = (typeof EMPLOYMENT_MODES)[number];

export const AUTH_COOKIE = 'lms_token';
