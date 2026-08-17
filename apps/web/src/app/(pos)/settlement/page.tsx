'use client';

import React from 'react';

export default function SettlementDashboardPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center h-full text-slate-500">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">POS Settlement & Reconciliation</h1>
      <p className="mb-4">This feature is not available in offline/desktop mode.</p>
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 w-full">
        <p className="text-yellow-700 text-center">Please use the online dashboard for manager approvals and reconciliation.</p>
      </div>
    </div>
  );
}
