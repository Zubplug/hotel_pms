import NextAuth from 'next-auth';

// Minimal edge-compatible NextAuth config for middleware
// Must include secret to avoid #missingsecret error
// NOTE: Cannot use PrismaAdapter in Edge runtime
const { auth } = NextAuth({
  providers: [],
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
});

// Routes that do NOT require authentication
const PUBLIC_PATHS = ['/login', '/api/auth'];

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
    // If already logged in and hitting /login → send to /properties
    if (nextUrl.pathname === '/login' && isLoggedIn) {
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
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
