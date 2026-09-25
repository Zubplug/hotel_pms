import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      staffId?: string | null;
      isLodgeCoreAdmin: boolean;
      isSuperAdmin: boolean;
      propertyId?: string | null;
      organizationId?: string | null;
      capabilities?: string[];
      role?: string;
      sessionVersion?: number;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    staffId?: string | null;
    isLodgeCoreAdmin: boolean;
    isSuperAdmin: boolean;
    propertyId?: string | null;
    organizationId?: string | null;
    capabilities?: string[];
    role?: string;
    sessionVersion?: number;
  }
}
