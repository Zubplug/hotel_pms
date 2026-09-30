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
      // HQ administrators do not require an organization membership. Keep the
      // initial lookup on User only so HQ login is not coupled to the customer
      // membership relation being present or populated.
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.lockedUntil && user.lockedUntil > new Date()) return null;
      if (!await bcrypt.compare(password, user.passwordHash)) return null;
      const staff = user.staffId ? await prisma.staff.findUnique({ where: { id: user.staffId }, select: { organizationId: true, firstName: true, lastName: true } }) : null;
      const membership = user.isLodgeCoreAdmin ? null : await prisma.organizationMembership.findUnique({ where: { userId: user.id } });
      const organizationId = staff?.organizationId || membership?.organizationId || null;
      if (!organizationId && !user.isLodgeCoreAdmin) return null;
      return { id: user.id, email: user.email, name: staff ? `${staff.firstName} ${staff.lastName}`.trim() : user.email, organizationId, isLodgeCoreAdmin: user.isLodgeCoreAdmin, isSuperAdmin: user.isSuperAdmin || user.isLodgeCoreAdmin };
    },
  })],
});
