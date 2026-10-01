import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@hotel-pms/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({ ...authConfig,
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials?.email || "").trim().toLowerCase();
      const password = String(credentials?.password || "");
      if (!email || !password) return null;
      
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || (user.lockedUntil && user.lockedUntil > new Date())) return null;
      if (!(await bcrypt.compare(password, user.passwordHash))) return null;
      // HQ Administrators are not allowed to log in via the Customer Portal.
      if (user.isLodgeCoreAdmin) {
        return null; // Block login
      }
      
      const staff = user.staffId ? await prisma.staff.findUnique({ where: { id: user.staffId }, select: { organizationId: true, firstName: true, lastName: true } }) : null;
      const membership = await prisma.organizationMembership.findUnique({ where: { userId: user.id } });
      const organizationId = staff?.organizationId || membership?.organizationId || null;
      
      if (!organizationId) return null;
      
      return { id: user.id, email: user.email, name: staff ? `${staff.firstName} ${staff.lastName}`.trim() : user.email, organizationId, isLodgeCoreAdmin: false, isSuperAdmin: false };
    },
  })],
});
