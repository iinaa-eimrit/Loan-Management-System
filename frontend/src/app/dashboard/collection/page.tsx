'use client';

import { useState, type FormEvent } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import type { Loan, Payment } from '@/lib/types';
import { Alert, Button, Card, Input } from '@/components/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function CollectionPage() {
  const loans = useFetch<{ loans: Loan[] }>('/ops/collection/loans');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = loans.data?.loans.find((l) => l._id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Collection · Active loans</h1>
      {notice && <Alert kind="success">{notice}</Alert>}
      {loans.error && <Alert>{loans.error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr><th className="p-3">Borrower</th><th className="p-3">Total</th><th className="p-3">Outstanding</th></tr>
            </thead>
            <tbody>
              {loans.data?.loans.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={3}>No active loans.</td></tr>}
              {loans.data?.loans.map((l) => (
                <tr key={l._id} onClick={() => { setSelectedId(l._id); setNotice(null); }}
                  className={`cursor-pointer border-t hover:bg-slate-50 transition ${l._id === selectedId ? 'bg-indigo-50 font-medium' : ''}`}>
                  <td className="p-3 font-medium">{l.borrowerSnapshot.fullName}</td>
                  <td className="p-3">{formatPaise(l.totalRepayment)}</td>
                  <td className="p-3 font-semibold text-indigo-700">{formatPaise(l.outstanding ?? l.totalRepayment - l.amountPaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {selected ? (
          <PaymentPanel
            key={selected._id}
            loan={selected}
            onRecorded={async (closed) => {
              if (closed) {
                setNotice(`Loan for ${selected.borrowerSnapshot.fullName} fully repaid and CLOSED.`);
                setSelectedId(null);
              }
              await loans.reload();
            }}
          />
        ) : (
          <Card><p className="text-slate-500">Select a loan to record a payment.</p></Card>
        )}
      </div>
    </div>
  );
}

function PaymentPanel({ loan, onRecorded }: { loan: Loan; onRecorded: (closed: boolean) => Promise<void> }) {
  const payments = useFetch<{ payments: Payment[] }>(`/ops/collection/loans/${loan._id}/payments`);
  const outstanding = loan.outstanding ?? loan.totalRepayment - loan.amountPaid;
  const [form, setForm] = useState({ utr: '', amount: (outstanding / 100).toFixed(2), paidOn: today() });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<{ closed: boolean }>(`/ops/collection/loans/${loan._id}/payments`, {
        method: 'POST',
        json: { utr: form.utr, amount: Number(form.amount), paidOn: form.paidOn },
      });
      setForm((f) => ({ ...f, utr: '' }));
      await payments.reload();
      await onRecorded(res.closed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">{loan.borrowerSnapshot.fullName}</h2>
        <p className="text-sm text-slate-500">
          Paid {formatPaise(loan.amountPaid)} of {formatPaise(loan.totalRepayment)} · Outstanding <b className="text-indigo-700">{formatPaise(outstanding)}</b>
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
        <Input label="UTR number" required value={form.utr} onChange={(e) => setForm({ ...form, utr: e.target.value.toUpperCase() })} />
        <Input label="Amount (₹)" type="number" step="0.01" min="0.01" max={(outstanding / 100).toFixed(2)} required
          value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label="Paid on" type="date" max={today()} required value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
        <div className="sm:col-span-3">
          {error && <div className="mb-2"><Alert>{error}</Alert></div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Recording…' : 'Record payment'}</Button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Payment history</h3>
        {payments.data?.payments.length === 0 && <p className="text-sm text-slate-400">No payments yet.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {payments.data?.payments.map((p) => (
            <li key={p._id} className="flex justify-between py-2">
              <span className="font-mono text-xs sm:text-sm">{p.utr}</span>
              <span className="text-slate-500">{formatDate(p.paidOn)}</span>
              <span className="font-semibold text-emerald-700">{formatPaise(p.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
