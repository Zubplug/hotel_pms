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
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).staffId = token.staffId as string;
        (session.user as any).isSuperAdmin = token.isSuperAdmin as boolean;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});

// Routes that do NOT require authentication via NextAuth cookies
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/v1/hardware'];

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
    // If already logged in and hitting /login
    if (nextUrl.pathname === '/login' && isLoggedIn) {
      const role = (req.auth as any)?.user?.role as string | undefined;
      if (role === 'RECEPTIONIST' || role === 'FRONT_DESK') {
        return Response.redirect(new URL('/frontdesk', nextUrl));
      } else if (role === 'CEO' || role === 'SUPER_ADMIN') {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return Response.redirect(new URL('/properties', nextUrl));
    }
    return;
  }

  // Protected route — redirect to login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  // Authorization checks
  const role = (req.auth as any)?.user?.role as string | undefined;
  
  if ((nextUrl.pathname.startsWith('/dashboard') || nextUrl.pathname.startsWith('/properties')) && (role === 'RECEPTIONIST' || role === 'FRONT_DESK')) {
    return Response.redirect(new URL('/frontdesk', nextUrl));
  }
  
  if (nextUrl.pathname.startsWith('/frontdesk') && role !== 'RECEPTIONIST' && role !== 'FRONT_DESK' && !(req.auth as any)?.user?.isSuperAdmin) {
    // If CEO tries to hit frontdesk, send them to dashboard
    if (role === 'CEO' || role === 'SUPER_ADMIN') {
      return Response.redirect(new URL('/dashboard', nextUrl));
    }
    return Response.redirect(new URL('/properties', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
