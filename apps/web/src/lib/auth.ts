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
        employerId: { label: 'Employer ID', type: 'text' },
        loginType: { label: 'Login type', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          return null;
        }

        const isEmployeeLogin = String(credentials.loginType || '').toLowerCase() === 'employee';
        let user: any = null;
        let staff: any = null;

        if (isEmployeeLogin) {
          const employerId = String(credentials.employerId || '').trim();
          if (!employerId) return null;

          const normalizedEmployerId = employerId.toUpperCase();

          // Employer IDs are legacy nullable/non-unique fields. Reject
          // duplicates rather than silently authenticating the wrong tenant.
          const matches = await prisma.staff.findMany({
            where: {
              employeeId: { equals: employerId, mode: 'insensitive' },
              isActive: true,
              deletedAt: null,
            },
            select: { id: true, firstName: true, lastName: true, organizationId: true, userId: true, email: true },
            take: 2,
          });

          // Older staff records may not have a persisted employeeId. The HR
          // API displays a deterministic fallback code for those records.
          // UUID fields cannot use Prisma's startsWith filter, so compare the
          // short prefix after reading only the eligible legacy rows.
          if (matches.length === 0 && normalizedEmployerId.startsWith('EMP-')) {
            const fallbackMatches = await prisma.staff.findMany({
              where: { employeeId: null, isActive: true, deletedAt: null },
              select: { id: true, firstName: true, lastName: true, organizationId: true, userId: true, email: true },
            });
            const prefix = normalizedEmployerId.slice(4).toLowerCase();
            matches.push(...fallbackMatches.filter((candidate) => candidate.id.slice(0, prefix.length) === prefix).slice(0, 2));
          }

          if (matches.length !== 1) return null;
          staff = matches[0];
          // Older staff records may have been created before web accounts were
          // provisioned. Fall back to the staff email so those accounts can be
          // linked during login instead of failing with a generic credential error.
          user = matches[0].userId
            ? await prisma.user.findUnique({ where: { id: matches[0].userId }, include: { membership: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } })
            : await prisma.user.findFirst({ where: { email: { equals: matches[0].email.trim(), mode: 'insensitive' } }, include: { membership: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
        } else {
          if (!credentials.email) return null;
          const email = String(credentials.email).trim().toLowerCase();
          user = await prisma.user.findUnique({
            where: { email },
            include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
          });
        }

        if (!user || !user.passwordHash) {
          return null;
        }

        if (!staff) {
          staff = await prisma.staff.findFirst({
            where: {
              OR: [
                ...(user.staffId ? [{ id: user.staffId }] : []),
                { userId: user.id }
              ]
            },
            select: { id: true, firstName: true, lastName: true, organizationId: true }
          });
        }
        
        // Ensure staffId is populated on user if we found the staff via userId
        if (staff && !user.staffId) {
          user.staffId = staff.id;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        if (isEmployeeLogin && staff && staff.userId !== user.id) {
          // Complete the legacy link once the employee proves possession of
          // the existing work-account password above.
          await prisma.$transaction([
            prisma.staff.update({ where: { id: staff.id }, data: { userId: user.id } }),
            ...(user.staffId ? [] : [prisma.user.update({ where: { id: user.id }, data: { staffId: staff.id } })]),
          ]);
          user.staffId = staff.id;
        }
        if (isEmployeeLogin && staff) {
          if (user.membership && user.membership.organizationId !== staff.organizationId) return null;
          if (user.membership?.status !== 'ACTIVE') return null;
          if (!user.membership) {
            await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: staff.organizationId, status: 'ACTIVE', role: 'MEMBER' } });
          }
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
        
        // Keep the external-auditor boundary authoritative even when an account
        // has legacy or secondary roles. The portal still validates engagements
        // from ExternalAuditorAccess on every request.
        let primaryRole = user.roles?.some((ur: any) => ur.role?.name === 'EXTERNAL_AUDITOR')
          ? 'EXTERNAL_AUDITOR'
          : user.roles?.[0]?.role?.name || 'STAFF';
        let organizationId = staff?.organizationId || user.roles?.[0]?.role?.organizationId || null;
        let propertyId = propertyIds.length > 0 ? propertyIds[0] : null;

        // Industry standard: Super Admin bypasses normal role checks and gets all capabilities
        if (user.isLodgeCoreAdmin) {
          const allPermissions = await prisma.permission.findMany({ select: { name: true } });
          capabilities = Array.from(new Set([...capabilities, ...allPermissions.map(p => p.name)]));
          primaryRole = 'SUPER_ADMIN';

          // Ensure Super Admin has a working context only within an organization
          // explicitly associated with the account.
          if (!propertyId) {
            const organizationIds = Array.from(new Set([
              staff?.organizationId,
              ...(user.roles ?? []).map((ur: any) => ur.role?.organizationId),
            ].filter((id): id is string => Boolean(id))));
            const firstProperty = organizationIds.length
              ? await prisma.property.findFirst({ where: { organizationId: { in: organizationIds } } })
              : null;
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
          name: staff ? `${staff.firstName} ${staff.lastName}`.trim() : null,
          staffId: user.staffId,
          isLodgeCoreAdmin: user.isLodgeCoreAdmin,
          isSuperAdmin: user.isLodgeCoreAdmin || user.isSuperAdmin,
          role: primaryRole,
          capabilities,
          sessionVersion: user.sessionVersion || 1,
          propertyId,
          organizationId,
          selfServiceOnly: isEmployeeLogin
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        token.id = user.id;
        token.name = user.name;
        token.staffId = user.staffId;
        token.isLodgeCoreAdmin = (user as any).isLodgeCoreAdmin;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.role = (user as any).role;
        token.capabilities = (user as any).capabilities;
        token.sessionVersion = (user as any).sessionVersion;
        token.propertyId = (user as any).propertyId;
        token.organizationId = (user as any).organizationId;
        token.selfServiceOnly = (user as any).selfServiceOnly;
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
        session.user.name = token.name as string | null;
        session.user.staffId = token.staffId as string;
        session.user.isLodgeCoreAdmin = token.isLodgeCoreAdmin as boolean;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
        session.user.role = token.role as string;
        session.user.capabilities = token.capabilities as string[];
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.propertyId = token.propertyId as string | null;
        session.user.organizationId = token.organizationId as string | null;
        (session.user as any).selfServiceOnly = token.selfServiceOnly as boolean;
      }
      return session;
    },
  },
});
