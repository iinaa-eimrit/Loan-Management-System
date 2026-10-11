'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import { calculateAge } from '@/lib/bre';
import type { Loan } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export default function SanctionPage() {
  const { data, error, loading, reload } = useFetch<{ loans: Loan[] }>('/ops/sanction/loans');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      setRejectingId(null);
      setReason('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sanction · Review applications</h1>
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {loading && !data && <p className="text-slate-500">Loading…</p>}
      {data?.loans.length === 0 && <Card><p className="text-slate-500">No applications awaiting review.</p></Card>}

      {data?.loans.map((loan) => {
        const s = loan.borrowerSnapshot;
        const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
        return (
          <Card key={loan._id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-base">{s.fullName}</p>
                <p className="text-sm text-slate-500">{borrower?.email} · applied {formatDate(loan.createdAt)}</p>
              </div>
              <a className="text-sm font-semibold text-indigo-600 hover:underline" href={`/api/ops/loans/${loan._id}/salary-slip`} target="_blank" rel="noreferrer">
                View salary slip ↗
              </a>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div><dt className="text-slate-500">PAN</dt><dd className="font-mono font-medium">{s.pan}</dd></div>
              <div><dt className="text-slate-500">Age</dt><dd className="font-medium">{calculateAge(new Date(s.dob).toISOString())}</dd></div>
              <div><dt className="text-slate-500">Salary / mo</dt><dd className="font-medium">{formatPaise(s.monthlySalary * 100)}</dd></div>
              <div><dt className="text-slate-500">Employment</dt><dd className="font-medium">{s.employmentMode.replace('_', ' ')}</dd></div>
              <div><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{formatPaise(loan.principal)}</dd></div>
              <div><dt className="text-slate-500">Tenure</dt><dd className="font-medium">{loan.tenureDays} days</dd></div>
              <div><dt className="text-slate-500">Interest</dt><dd className="font-medium">{formatPaise(loan.simpleInterest)}</dd></div>
              <div><dt className="text-slate-500">Total</dt><dd className="font-semibold text-indigo-700">{formatPaise(loan.totalRepayment)}</dd></div>
            </dl>

            {rejectingId === loan._id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                  rows={2}
                  placeholder="Reason for rejection (required, min 5 chars)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={busyId === loan._id || reason.trim().length < 5}
                    onClick={() => run(loan._id, () => api(`/ops/sanction/loans/${loan._id}/reject`, { method: 'PATCH', json: { reason } }))}>
                    Confirm reject
                  </Button>
                  <Button variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button disabled={busyId === loan._id}
                  onClick={() => run(loan._id, () => api(`/ops/sanction/loans/${loan._id}/approve`, { method: 'PATCH' }))}>
                  Approve
                </Button>
                <Button variant="ghost" onClick={() => { setRejectingId(loan._id); setReason(''); }}>Reject</Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
