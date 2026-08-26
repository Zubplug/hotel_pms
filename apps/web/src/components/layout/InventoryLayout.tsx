'use client';

import React from 'react';
import { InventorySidebar } from './InventorySidebar';

export function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      <InventorySidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950/50 backdrop-blur-xl border-l border-zinc-800/50 shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-zinc-950/50 to-zinc-950/80 -z-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
