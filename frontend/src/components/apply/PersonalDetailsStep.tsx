'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { previewBre } from '@/lib/bre';
import type { BorrowerProfile, BreFailure, EmploymentMode } from '@/lib/types';
import { Alert, Button, Card, Input } from '@/components/ui';

export function PersonalDetailsStep({ initial, onDone }: { initial: BorrowerProfile | null; onDone: () => void }) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? '',
    pan: initial?.pan ?? '',
    dob: initial?.dob?.slice(0, 10) ?? '',
    monthlySalary: initial?.monthlySalary?.toString() ?? '',
    employmentMode: (initial?.employmentMode ?? 'SALARIED') as EmploymentMode,
  });
  const [serverFailures, setServerFailures] = useState<BreFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientFailures = useMemo(
    () => previewBre({ pan: form.pan, dob: form.dob, monthlySalary: Number(form.monthlySalary), employmentMode: form.employmentMode }),
    [form],
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'pan' ? e.target.value.toUpperCase() : e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setServerFailures([]);
    setSubmitting(true);
    try {
      await api('/borrower/profile', {
        method: 'PUT',
        json: { ...form, monthlySalary: Number(form.monthlySalary) },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setServerFailures((err.errors as BreFailure[]) ?? []);
      } else {
        setError(err instanceof Error ? err.message : 'Could not save details');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Personal details</h2>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Full name (as on PAN)" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <Input label="PAN" required maxLength={10} placeholder="ABCPE1234F" value={form.pan} onChange={set('pan')} />
        <Input label="Date of birth" type="date" required value={form.dob} onChange={set('dob')} />
        <Input label="Monthly salary (₹)" type="number" min={0} required value={form.monthlySalary} onChange={set('monthlySalary')} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Employment mode</span>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={form.employmentMode} onChange={set('employmentMode')}>
            <option value="SALARIED">Salaried</option>
            <option value="SELF_EMPLOYED">Self-employed</option>
            <option value="UNEMPLOYED">Unemployed</option>
          </select>
        </label>

        <div className="space-y-3 sm:col-span-2">
          {clientFailures.length > 0 && serverFailures.length === 0 && (
            <Alert kind="info">
              <p className="font-medium">Heads up: these may fail the eligibility check</p>
              <ul className="ml-4 list-disc">{clientFailures.map((f) => <li key={f.rule}>{f.message}</li>)}</ul>
            </Alert>
          )}
          {serverFailures.length > 0 && (
            <Alert>
              <p className="font-semibold">Application blocked: eligibility check failed</p>
              <ul className="ml-4 list-disc">{serverFailures.map((f) => <li key={f.rule}>{f.message}</li>)}</ul>
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Checking eligibility…' : 'Save & check eligibility'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
