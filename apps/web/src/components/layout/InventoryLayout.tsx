'use client';

import React from 'react';
import { InventorySidebar } from './InventorySidebar';

export function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <InventorySidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50/50 border-l border-slate-200 shadow-sm relative">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
