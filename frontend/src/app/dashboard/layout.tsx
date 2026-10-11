'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MODULES } from '@/lib/roles';
import { Button } from '@/components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return <p className="p-8 text-slate-500">Loading…</p>;

  const visible = MODULES.filter((m) => m.roles.includes(user.role));

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-slate-50">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <span className="font-bold text-indigo-600">LMS · Operations</span>
          <span className="text-xs uppercase tracking-wide text-slate-500 md:mt-1 md:block font-medium">{user.role}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {visible.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith(m.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 py-4 md:block border-t border-slate-100 mt-auto">
          <p className="mb-2 truncate text-sm text-slate-600">{user.name}</p>
          <Button variant="ghost" className="w-full" onClick={logout}>Logout</Button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-8">
        <div className="mb-4 flex justify-end md:hidden"><Button variant="ghost" onClick={logout}>Logout</Button></div>
        {children}
      </main>
    </div>
  );
}
