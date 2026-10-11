'use client';

import { useFetch } from '@/hooks/useFetch';
import { formatDate } from '@/lib/format';
import { Alert, Card } from '@/components/ui';

interface Lead {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  fullName?: string;
  monthlySalary?: number;
  profileCompleted: boolean;
  salarySlipUploaded: boolean;
}

const Check = ({ ok }: { ok: boolean }) => <span className={ok ? 'text-emerald-600 font-bold' : 'text-slate-300'}>{ok ? '●' : '○'}</span>;

export default function SalesPage() {
  const { data, error, loading } = useFetch<{ leads: Lead[] }>('/ops/sales/leads');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sales · Leads</h1>
      <p className="text-sm text-slate-500">Registered borrowers who haven&apos;t applied yet.</p>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Registered</th><th className="p-3">Details</th><th className="p-3">Slip</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3 text-slate-400" colSpan={5}>Loading…</td></tr>}
            {data?.leads.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={5}>No leads 🎉</td></tr>}
            {data?.leads.map((l) => (
              <tr key={l._id} className="border-t">
                <td className="p-3 font-medium">{l.fullName ?? l.name}</td>
                <td className="p-3">{l.email}</td>
                <td className="p-3">{formatDate(l.createdAt)}</td>
                <td className="p-3"><Check ok={l.profileCompleted} /></td>
                <td className="p-3"><Check ok={l.salarySlipUploaded} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
