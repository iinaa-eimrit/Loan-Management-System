'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { calculateLoan, INTEREST_RATE_PA, LIMITS } from '@/lib/loanMath';
import { formatPaise } from '@/lib/format';
import type { FileInfo } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export function LoanConfigStep({ slip, onDone }: { slip: FileInfo; onDone: () => void }) {
  const [amount, setAmount] = useState(100_000);
  const [tenure, setTenure] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const quote = useMemo(() => calculateLoan(amount, tenure), [amount, tenure]);

  async function apply() {
    setError(null);
    setSubmitting(true);
    try {
      await api('/borrower/loans', { method: 'POST', json: { amount, tenureDays: tenure } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure your loan</h2>
        <p className="text-sm text-slate-500">Salary slip: {slip.originalName} ✓</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Loan amount</span>
          <span className="font-semibold text-indigo-600">{formatPaise(amount * 100)}</span>
        </div>
        <input
          type="range"
          min={LIMITS.minAmount}
          max={LIMITS.maxAmount}
          step={LIMITS.amountStep}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer"
          aria-label="Loan amount"
        />
        <div className="flex justify-between text-xs text-slate-400"><span>₹50K</span><span>₹5L</span></div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Tenure</span>
          <span className="font-semibold text-indigo-600">{tenure} days</span>
        </div>
        <input
          type="range"
          min={LIMITS.minTenure}
          max={LIMITS.maxTenure}
          step={1}
          value={tenure}
          onChange={(e) => setTenure(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer"
          aria-label="Tenure in days"
        />
        <div className="flex justify-between text-xs text-slate-400"><span>30 days</span><span>365 days</span></div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4 border border-slate-100">
        <div><dt className="text-slate-500">Principal</dt><dd className="font-semibold">{formatPaise(quote.principal)}</dd></div>
        <div><dt className="text-slate-500">Rate</dt><dd className="font-semibold">{INTEREST_RATE_PA}% p.a.</dd></div>
        <div><dt className="text-slate-500">Interest (SI)</dt><dd className="font-semibold">{formatPaise(quote.simpleInterest)}</dd></div>
        <div><dt className="text-slate-500">Total repayment</dt><dd className="font-bold text-indigo-700">{formatPaise(quote.totalRepayment)}</dd></div>
      </dl>
      <p className="text-xs text-slate-400">SI = (P × R × T) / (365 × 100), T = tenure in days</p>

      {error && <Alert>{error}</Alert>}
      <Button onClick={apply} disabled={submitting} className="w-full">{submitting ? 'Submitting…' : 'Apply'}</Button>
    </Card>
  );
}
