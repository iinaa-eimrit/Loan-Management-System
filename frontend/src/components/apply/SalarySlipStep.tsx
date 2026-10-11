'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Alert, Button, Card } from '@/components/ui';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];

export function SalarySlipStep({ onDone }: { onDone: () => void; onBack: null }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && !ACCEPT.includes(f.type)) {
      setError('Only PDF, JPG or PNG files are allowed');
      setFile(null);
      return;
    }
    if (f && f.size > MAX_BYTES) {
      setError('File is larger than 5 MB');
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('salarySlip', file);
      await api('/borrower/salary-slip', { method: 'POST', formData: fd });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Upload salary slip</h2>
      <p className="mb-4 text-sm text-slate-500">PDF, JPG or PNG · max 5 MB</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={onPick}
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-100 cursor-pointer"
        />
        {file && <p className="text-sm text-slate-600">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload & continue'}</Button>
      </form>
    </Card>
  );
}
