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
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/v1/hardware', '/api/manager', '/api/mobile', '/api/desktop-update'];

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
      // Phase 1.5: Always redirect authenticated users to the Universal Hub
      return Response.redirect(new URL('/hub', nextUrl));
    }
    return;
  }

  // Protected route — redirect to login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  // Phase 1.6: Removed hardcoded role-based routing checks in middleware.
  // The Universal Hub (/hub) dynamically renders tiles based on the user's `capabilities`.
  // Individual modules (like /pos, /frontdesk) enforce capability checks in their layouts/pages.
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
