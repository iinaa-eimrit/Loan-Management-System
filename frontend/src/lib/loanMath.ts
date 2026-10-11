export const INTEREST_RATE_PA = 12;
export const LIMITS = { minAmount: 50_000, maxAmount: 500_000, amountStep: 5_000, minTenure: 30, maxTenure: 365 };

export function calculateLoan(principalRupees: number, tenureDays: number) {
  const principal = Math.round(principalRupees * 100);
  const simpleInterest = Math.round((principal * INTEREST_RATE_PA * tenureDays) / (365 * 100));
  return { principal, simpleInterest, totalRepayment: principal + simpleInterest };
}
