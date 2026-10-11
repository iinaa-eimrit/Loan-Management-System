import type { Loan, LoanStatus } from '@/lib/types';
import { formatDate, formatPaise } from '@/lib/format';
import { Card, StatusBadge } from '@/components/ui';

const MESSAGES: Record<LoanStatus, string> = {
  APPLIED: 'Your application is under review by our sanction team.',
  SANCTIONED: 'Approved! Funds will be disbursed shortly.',
  REJECTED: 'Unfortunately your application was not approved.',
  DISBURSED: 'Funds have been released. Repayment is in progress.',
  CLOSED: 'Fully repaid. This loan is closed. Thank you!',
};

export function LoanStatusCard({ loan, compact = false }: { loan: Loan; compact?: boolean }) {
  const pct = Math.min(100, Math.round((loan.amountPaid / loan.totalRepayment) * 100));
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{compact ? 'Previous application' : 'Your loan'}</h2>
        <StatusBadge status={loan.status} />
      </div>
      <p className="text-sm text-slate-600">{MESSAGES[loan.status]}</p>
      {loan.status === 'REJECTED' && loan.rejectionReason && (
        <p className="text-sm text-rose-700 font-medium">Reason: {loan.rejectionReason}</p>
      )}
      {!compact && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{formatPaise(loan.principal)}</dd></div>
            <div><dt className="text-slate-500">Tenure</dt><dd className="font-semibold">{loan.tenureDays} days</dd></div>
            <div><dt className="text-slate-500">Total repayment</dt><dd className="font-semibold text-indigo-700">{formatPaise(loan.totalRepayment)}</dd></div>
            <div><dt className="text-slate-500">Applied on</dt><dd className="font-semibold">{formatDate(loan.createdAt)}</dd></div>
          </dl>
          {loan.status === 'DISBURSED' && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500 font-medium">
                <span>Repaid {formatPaise(loan.amountPaid)}</span><span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-2 rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
