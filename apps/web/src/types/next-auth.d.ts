import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      staffId?: string | null;
      isSuperAdmin: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    staffId?: string | null;
    isSuperAdmin: boolean;
  }
}
