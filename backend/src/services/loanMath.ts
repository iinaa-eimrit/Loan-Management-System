export const INTEREST_RATE_PA = 12;

export const LOAN_LIMITS = {
  minAmount: 50_000,
  maxAmount: 500_000,
  minTenureDays: 30,
  maxTenureDays: 365,
} as const;

export interface LoanQuote {
  principal: number;
  simpleInterest: number;
  totalRepayment: number;
}

export function calculateLoan(principalRupees: number, tenureDays: number, ratePa: number = INTEREST_RATE_PA): LoanQuote {
  const principal = Math.round(principalRupees * 100);
  const simpleInterest = Math.round((principal * ratePa * tenureDays) / (365 * 100));
  return { principal, simpleInterest, totalRepayment: principal + simpleInterest };
}
