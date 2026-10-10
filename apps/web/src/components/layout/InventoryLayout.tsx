'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { InventorySidebar } from './InventorySidebar';
import { CashManagementLayout } from './CashManagementLayout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PropertySelector } from '@/components/properties/PropertySelector';

export function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useLodgeCoreSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasMultipleProperties, setHasMultipleProperties] = useState(false);
  const role = (session?.user as any)?.role;
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/inventory';
  const routeName = pathname === '/inventory' ? 'Inventory overview' : pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') || 'Inventory';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // General cashier uses the cash management layout
  if (role === 'GENERAL_CASHIER') {
    return <CashManagementLayout>{children}</CashManagementLayout>;
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) return null;

  return (
    <div className="flex h-screen bg-[#08111f] overflow-hidden font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close */}
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-white lg:hidden z-10"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
        <InventorySidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top header */}
        <div className="hidden" aria-hidden="true">
          <PropertySelector onMultiplePropertiesChange={setHasMultipleProperties} />
        </div>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0b1728]/95 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Button
              aria-label="Open inventory navigation"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.06] lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 sm:tracking-[0.2em]">Inventory control</p><p className="truncate text-sm font-semibold capitalize text-white">{routeName}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live ledger</span>
            {hasMultipleProperties && <div className="hidden sm:block"><PropertySelector className="max-w-[150px] sm:max-w-[220px]" onMultiplePropertiesChange={setHasMultipleProperties} /></div>}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-[#08111f]">
          {children}
        </div>
      </main>
    </div>
  );
}
