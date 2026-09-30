import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  // Keep production deployments compatible with both NextAuth naming conventions.
  // The same secret must be present for the login handler, middleware, and HQ guard.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/portal/login" },
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user),
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = (user as { organizationId?: string | null }).organizationId;
        token.isLodgeCoreAdmin = (user as { isLodgeCoreAdmin?: boolean }).isLodgeCoreAdmin;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const websiteUser = session.user as { organizationId?: string | null; isLodgeCoreAdmin?: boolean; isSuperAdmin?: boolean };
        websiteUser.organizationId = token.organizationId as string | null;
        websiteUser.isLodgeCoreAdmin = token.isLodgeCoreAdmin as boolean;
        websiteUser.isSuperAdmin = token.isSuperAdmin as boolean;
      }
      return session;
    },
  },
};
