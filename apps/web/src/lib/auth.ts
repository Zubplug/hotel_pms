import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { 
            roles: { 
              include: { 
                role: { include: { permissions: { include: { permission: true } } } } 
              } 
            } 
          }
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        let capabilities: string[] = [];
        const propertyIds: string[] = [];
        
        if (user.roles) {
          user.roles.forEach((ur: any) => {
            if (ur.propertyId) propertyIds.push(ur.propertyId);
            ur.role.permissions.forEach((rp: any) => {
              if (rp.permission?.name) {
                capabilities.push(rp.permission.name);
              }
            });
          });
        }
        
        capabilities = Array.from(new Set(capabilities));
        
        let primaryRole = user.roles?.[0]?.role?.name || 'STAFF';
        let organizationId = user.roles?.[0]?.role?.organizationId || null;
        let propertyId = propertyIds.length > 0 ? propertyIds[0] : null;

        // Industry standard: Super Admin bypasses normal role checks and gets all capabilities
        if (user.isSuperAdmin) {
          const allPermissions = await prisma.permission.findMany({ select: { name: true } });
          capabilities = Array.from(new Set([...capabilities, ...allPermissions.map(p => p.name)]));
          primaryRole = 'SUPER_ADMIN';

          // Ensure Super Admin has a working context if no roles are assigned
          if (!propertyId) {
            const firstProperty = await prisma.property.findFirst();
            if (firstProperty) {
              propertyId = firstProperty.id;
              organizationId = firstProperty.organizationId;
            }
          }
        }

        // Return user object
        return {
          id: user.id,
          email: user.email,
          staffId: user.staffId,
          isSuperAdmin: user.isSuperAdmin,
          role: primaryRole,
          capabilities,
          sessionVersion: user.sessionVersion || 1,
          propertyId,
          organizationId
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        token.id = user.id;
        token.staffId = user.staffId;
        token.isSuperAdmin = user.isSuperAdmin;
        token.role = (user as any).role;
        token.capabilities = (user as any).capabilities;
        token.sessionVersion = (user as any).sessionVersion;
        token.propertyId = (user as any).propertyId;
        token.organizationId = (user as any).organizationId;
      } else if (token.id) {
        // Validate session version on subsequent requests to support remote revocation
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { sessionVersion: true }
          });
          if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) {
            // Revoke session if user was deleted or sessionVersion bumped
            return null as any; 
          }
        } catch (e) {
          // Ignore DB errors to prevent locking out on transient network issues
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.staffId = token.staffId as string;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
        session.user.role = token.role as string;
        session.user.capabilities = token.capabilities as string[];
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.propertyId = token.propertyId as string | null;
        session.user.organizationId = token.organizationId as string | null;
      }
      return session;
    },
  },
});
