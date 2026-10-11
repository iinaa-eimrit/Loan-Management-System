import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { canAccessModule, homeFor } from '@/lib/roles';
import type { Role } from '@/lib/types';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getRole(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get('lms_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await getRole(req);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (pathname === '/login' || pathname === '/signup') {
    return role ? redirect(homeFor(role)) : NextResponse.next();
  }

  if (!role) return redirect('/login');

  if (pathname === '/') return redirect(homeFor(role));

  if (pathname.startsWith('/apply') && role !== 'borrower') return redirect(homeFor(role));

  if (pathname.startsWith('/dashboard')) {
    if (role === 'borrower') return redirect('/apply');
    const moduleKey = pathname.split('/')[2];
    if (!moduleKey || !canAccessModule(role, moduleKey)) return redirect(homeFor(role));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/signup', '/apply/:path*', '/dashboard/:path*'],
};
