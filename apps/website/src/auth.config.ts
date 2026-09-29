import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/portal/login" },
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user),
    async jwt({ token, user }) {
      if (user) token.organizationId = (user as { organizationId?: string }).organizationId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { organizationId?: string }).organizationId = token.organizationId as string;
      return session;
    },
  },
};
