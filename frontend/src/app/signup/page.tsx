'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Alert, Button, Card, Input } from '@/components/ui';

export default function SignupPage() {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form.name, form.email, form.password);
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.errors) && err.errors[0]?.message) {
        setError(err.errors[0].message);
      } else {
        setError(err instanceof Error ? err.message : 'Signup failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">Apply for a loan</h1>
        <p className="mb-6 text-sm text-slate-500">Create your borrower account</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input label="Name" name="name" required value={form.name} onChange={update} />
          <Input label="Email" name="email" type="email" required value={form.email} onChange={update} />
          <Input label="Password (min 8 chars)" name="password" type="password" minLength={8} required value={form.password} onChange={update} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating…' : 'Sign up'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Have an account? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
