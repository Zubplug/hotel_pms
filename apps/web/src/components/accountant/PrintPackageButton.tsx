'use client';

import { Printer } from 'lucide-react';

export function PrintPackageButton() {
  return <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 print:hidden">
    <Printer className="h-4 w-4" />
    Print package / save PDF
  </button>;
}
