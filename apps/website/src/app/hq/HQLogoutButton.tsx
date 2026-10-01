'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function HQLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
