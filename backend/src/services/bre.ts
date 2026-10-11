import type { EmploymentMode } from '../constants';

export const PAN_REGEX = /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/;

export const BRE_LIMITS = {
  minAge: 23,
  maxAge: 50,
  minMonthlySalary: 25_000,
} as const;

export interface BreInput {
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export type BreRule = 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';

export interface BreFailure {
  rule: BreRule;
  message: string;
}

export function calculateAge(dob: Date, today: Date = new Date()): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  const birthdayNotYetThisYear =
    monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate());
  if (birthdayNotYetThisYear) age--;
  return age;
}

export function runBre(input: BreInput, today: Date = new Date()): BreFailure[] {
  const failures: BreFailure[] = [];

  const age = calculateAge(input.dob, today);
  if (Number.isNaN(age) || age < BRE_LIMITS.minAge || age > BRE_LIMITS.maxAge) {
    failures.push({
      rule: 'AGE',
      message: `Applicant must be between ${BRE_LIMITS.minAge} and ${BRE_LIMITS.maxAge} years old (current age: ${Number.isNaN(age) ? 'invalid' : age}).`,
    });
  }

  if (input.monthlySalary < BRE_LIMITS.minMonthlySalary) {
    failures.push({
      rule: 'SALARY',
      message: `Monthly salary must be at least ₹${BRE_LIMITS.minMonthlySalary.toLocaleString('en-IN')}.`,
    });
  }

  if (!PAN_REGEX.test(input.pan.toUpperCase())) {
    failures.push({ rule: 'PAN', message: 'PAN must be in the valid format (e.g. ABCPE1234F).' });
  }

  if (input.employmentMode === 'UNEMPLOYED') {
    failures.push({ rule: 'EMPLOYMENT', message: 'Unemployed applicants are not eligible.' });
  }

  return failures;
}
