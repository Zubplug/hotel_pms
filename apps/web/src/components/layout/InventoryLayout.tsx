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
  const role = (session?.user as any)?.role;

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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
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
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <PropertySelector />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
