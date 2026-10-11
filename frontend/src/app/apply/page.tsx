'use client';

import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import type { BorrowerProfile, FileInfo, Loan } from '@/lib/types';
import { Alert, Button } from '@/components/ui';
import { Stepper } from '@/components/apply/Stepper';
import { PersonalDetailsStep } from '@/components/apply/PersonalDetailsStep';
import { SalarySlipStep } from '@/components/apply/SalarySlipStep';
import { LoanConfigStep } from '@/components/apply/LoanConfigStep';
import { LoanStatusCard } from '@/components/apply/LoanStatusCard';

interface BorrowerMe {
  profile: BorrowerProfile | null;
  salarySlip: FileInfo | null;
  activeLoan: Loan | null;
  loans: Loan[];
}

export default function ApplyPage() {
  const { user, logout } = useAuth();
  const { data, error, loading, reload } = useFetch<BorrowerMe>('/borrower/me');

  const step: 2 | 3 | 4 = !data?.profile ? 2 : !data.salarySlip ? 3 : 4;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <span className="font-bold text-indigo-600">LMS · Borrower Portal</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user?.name}</span>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        {loading && !data && <p className="text-slate-500 text-center py-8">Loading application details…</p>}
        {error && <Alert>{error}</Alert>}

        {data && (data.activeLoan ? (
          <LoanStatusCard loan={data.activeLoan} />
        ) : (
          <>
            {data.loans[0] && <LoanStatusCard loan={data.loans[0]} compact />}
            <Stepper current={step} />
            {step === 2 && <PersonalDetailsStep initial={data.profile} onDone={reload} />}
            {step === 3 && <SalarySlipStep onDone={reload} onBack={null} />}
            {step === 4 && <LoanConfigStep slip={data.salarySlip!} onDone={reload} />}
          </>
        ))}
      </main>
    </div>
  );
}
