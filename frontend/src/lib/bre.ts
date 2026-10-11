import type { EmploymentMode, BreFailure } from './types';

export const PAN_REGEX = /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/;

export function calculateAge(dobIso: string, today = new Date()): number {
  const dob = new Date(dobIso);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function previewBre(p: { pan: string; dob: string; monthlySalary: number; employmentMode: EmploymentMode }): BreFailure[] {
  const out: BreFailure[] = [];
  if (p.dob) {
    const age = calculateAge(p.dob);
    if (age < 23 || age > 50) out.push({ rule: 'AGE', message: `Age must be 23–50 (yours: ${age})` });
  }
  if (p.monthlySalary && p.monthlySalary < 25000) out.push({ rule: 'SALARY', message: 'Salary must be at least ₹25,000/month' });
  if (p.pan && !PAN_REGEX.test(p.pan.toUpperCase())) out.push({ rule: 'PAN', message: 'PAN format looks invalid (e.g. ABCPE1234F)' });
  if (p.employmentMode === 'UNEMPLOYED') out.push({ rule: 'EMPLOYMENT', message: 'Unemployed applicants are not eligible' });
  return out;
}
