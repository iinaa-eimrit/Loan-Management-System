import type { Role } from './types';

export type ModuleKey = 'sales' | 'sanction' | 'disbursement' | 'collection';

export const MODULES: { key: ModuleKey; label: string; href: string; roles: Role[] }[] = [
  { key: 'sales', label: 'Sales', href: '/dashboard/sales', roles: ['admin', 'sales'] },
  { key: 'sanction', label: 'Sanction', href: '/dashboard/sanction', roles: ['admin', 'sanction'] },
  { key: 'disbursement', label: 'Disbursement', href: '/dashboard/disbursement', roles: ['admin', 'disbursement'] },
  { key: 'collection', label: 'Collection', href: '/dashboard/collection', roles: ['admin', 'collection'] },
];

export function canAccessModule(role: Role, key: string): boolean {
  return MODULES.some((m) => m.key === key && m.roles.includes(role));
}

export function homeFor(role: Role): string {
  if (role === 'borrower') return '/apply';
  if (role === 'admin') return '/dashboard/sales';
  return `/dashboard/${role}`;
}
