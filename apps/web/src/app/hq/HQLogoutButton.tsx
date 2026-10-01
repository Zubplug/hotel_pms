'use client';

import { LogOut } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';

export function HQLogoutButton() {
  const logout = useLogout();

  return (
    <button
      type="button"
      onClick={logout}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-slate-400 transition hover:border-rose-300/20 hover:bg-rose-300/[.08] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <LogOut className="size-4" />
      Sign out securely
    </button>
  );
}
