import React from 'react';

export const metadata = {
  title: 'LodgeCore Hub',
  description: 'Unified Hotel Operating System Workstation',
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* 
        This is a full-screen layout designed for touch-first workstations, 
        distinct from the standard sidebar layouts.
      */}
      <main className="flex-1 flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
