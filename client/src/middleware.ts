import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't need protection
  if (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-otp' ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;
  const userRole = request.cookies.get('userRole')?.value || 'CUSTOMER';

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const isAdminRoute = pathname.startsWith('/admin');

  // Customer trying to access admin routes
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Admin trying to access customer routes
  const customerRoutes = ['/dashboard', '/transfer', '/transactions', '/payments', '/profile'];
  const isCustomerRoute = customerRoutes.some(route => pathname.startsWith(route));

  if (isCustomerRoute && isAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
