import NextAuth from 'next-auth';

// Minimal edge-compatible NextAuth config for middleware
// Must include secret to avoid #missingsecret error
// NOTE: Cannot use PrismaAdapter in Edge runtime
const { auth } = NextAuth({
  providers: [],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.staffId = (user as any).staffId;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.role = (user as any).role;
        token.capabilities = (user as any).capabilities;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).staffId = token.staffId as string;
        (session.user as any).isSuperAdmin = token.isSuperAdmin as boolean;
        (session.user as any).role = token.role;
        (session.user as any).capabilities = token.capabilities as string[];
      }
      return session;
    },
  },
});

// Routes that do NOT require authentication via NextAuth cookies
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/v1/hardware', '/api/manager', '/api/mobile', '/api/desktop-update', '/api/v1/pos', '/api/v1/sync', '/desktop'];

const MANAGEMENT_ROLES = ['CEO', 'SUPER_ADMIN', 'MANAGER', 'ADMIN', 'ACCOUNTANT'];
const POS_ROLES = ['WAITER', 'WAITRESS', 'CASHIER', 'POS', 'POS_OPERATOR'];
const FRONT_DESK_ROLES = ['RECEPTIONIST', 'FRONT_DESK'];
const INVENTORY_ROLES = ['STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER', 'OUTLET_HEAD'];

function hasModuleAccess(req: any, pathname: string): { allowed: boolean; redirectTo?: string } {
  const user = req.auth?.user as any;
  if (!user) return { allowed: false, redirectTo: '/login' };
  if (user.isSuperAdmin) return { allowed: true };

  const role = String(user.role || '').toUpperCase();
  const capabilities = Array.isArray(user.capabilities) ? user.capabilities : [];
  const can = (moduleCapability: string, roles: string[]) =>
    roles.includes(role) || capabilities.includes(moduleCapability);

  if (pathname === '/cash-management' || pathname.startsWith('/cash-management/')) {
    return can('ACCESS_CASH_MANAGEMENT', [...MANAGEMENT_ROLES, 'GENERAL_CASHIER'])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/pos' || pathname.startsWith('/pos/')) {
    return can('ACCESS_POS', [...POS_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/frontdesk' || pathname.startsWith('/frontdesk/')) {
    return can('ACCESS_FRONT_DESK', [...FRONT_DESK_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/inventory' || pathname.startsWith('/inventory/')) {
    return (can('ACCESS_INVENTORY', [...INVENTORY_ROLES, ...MANAGEMENT_ROLES, 'GENERAL_CASHIER']) ||
      capabilities.some((value: string) => value.startsWith('inventory.')))
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return can('ACCESS_MANAGEMENT', MANAGEMENT_ROLES)
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/') ||
      pathname === '/properties' || pathname.startsWith('/properties/') ||
      pathname === '/rooms' || pathname.startsWith('/rooms/') ||
      pathname === '/room-types' || pathname.startsWith('/room-types/') ||
      pathname === '/amenities' || pathname.startsWith('/amenities/') ||
      pathname === '/staff' || pathname.startsWith('/staff/') ||
      pathname === '/settings' || pathname.startsWith('/settings/')) {
    return can('ACCESS_MANAGEMENT', MANAGEMENT_ROLES) ||
      capabilities.some((value: string) => value.startsWith('MANAGE_'))
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/reports' || pathname.startsWith('/reports/')) {
    return can('ACCESS_REPORTS', [...MANAGEMENT_ROLES, 'GENERAL_CASHIER'])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/refunds' || pathname.startsWith('/refunds/')) {
    return can('ACCESS_REFUNDS', [...MANAGEMENT_ROLES, 'FINANCE_MANAGER'])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/night-audit' || pathname.startsWith('/night-audit/')) {
    return can('ACCESS_NIGHT_AUDIT', [...MANAGEMENT_ROLES, 'NIGHT_AUDITOR', 'GENERAL_CASHIER'])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/reservations' || pathname.startsWith('/reservations/')) {
    return can('ACCESS_FRONT_DESK', [...FRONT_DESK_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/sync-center' || pathname.startsWith('/sync-center/')) {
    return can('ACCESS_SYNC_CENTER', [...POS_ROLES, ...FRONT_DESK_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/housekeeping' || pathname.startsWith('/housekeeping/')) {
    return can('ACCESS_HOUSEKEEPING', ['HOUSEKEEPER', 'HOUSEKEEPING', ...FRONT_DESK_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  if (pathname === '/maintenance' || pathname.startsWith('/maintenance/')) {
    return can('ACCESS_MAINTENANCE', ['MAINTENANCE', ...FRONT_DESK_ROLES, ...MANAGEMENT_ROLES])
      ? { allowed: true } : { allowed: false, redirectTo: '/hub' };
  }
  return { allowed: true };
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Allow static assets through
  if (
    nextUrl.pathname.startsWith('/_next') ||
    nextUrl.pathname.startsWith('/favicon') ||
    nextUrl.pathname.match(/\.(svg|png|jpg|jpeg|ico|webp)$/)
  ) {
    return;
  }

  // Public routes — no auth needed
  if (isPublic(nextUrl.pathname)) {
    // If already logged in and hitting /login, send to /hub.
    // /hub will then smart-redirect based on role:
    //   MANAGER / CEO / SUPER_ADMIN  → /dashboard
    //   RECEPTIONIST / FRONT_DESK   → /frontdesk
    //   STOCK_MANAGER / PROCUREMENT → /inventory
    //   NIGHT_AUDITOR               → /night-audit
    //   Single-cap staff            → their one workspace
    //   Multi-cap staff             → hub tile picker
    if (nextUrl.pathname === '/login' && isLoggedIn) {
      return Response.redirect(new URL('/hub', nextUrl));
    }
    return;
  }

  // Protected route — redirect to login if not authenticated
  if (!isLoggedIn) {
    // If we are on the desktop app, auth is handled by client-side guards (useLodgeCoreSession)
    // because NextAuth cookies do not exist in the WebView2 session.
    if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') {
      return;
    }

    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  const moduleAccess = hasModuleAccess(req, nextUrl.pathname);
  if (!moduleAccess.allowed) {
    return Response.redirect(new URL(moduleAccess.redirectTo || '/hub', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
