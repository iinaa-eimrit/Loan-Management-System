'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import type { Loan } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export default function DisbursementPage() {
  const { data, error, loading, reload } = useFetch<{ loans: Loan[] }>('/ops/disbursement/loans');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function disburse(id: string) {
    if (!confirm('Confirm funds have been released to the borrower?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      await api(`/ops/disbursement/loans/${id}/disburse`, { method: 'PATCH' });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Disbursement · Sanctioned loans</h1>
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-3">Borrower</th><th className="p-3">Amount</th><th className="p-3">Tenure</th><th className="p-3">Sanctioned</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td className="p-3 text-slate-400" colSpan={5}>Loading…</td></tr>}
            {data?.loans.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={5}>Nothing to disburse.</td></tr>}
            {data?.loans.map((l) => (
              <tr key={l._id} className="border-t">
                <td className="p-3 font-medium">{l.borrowerSnapshot.fullName}</td>
                <td className="p-3">{formatPaise(l.principal)}</td>
                <td className="p-3">{l.tenureDays} d</td>
                <td className="p-3">{formatDate(l.sanctionedAt)}</td>
                <td className="p-3 text-right">
                  <Button disabled={busyId === l._id} onClick={() => disburse(l._id)}>Mark disbursed</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
