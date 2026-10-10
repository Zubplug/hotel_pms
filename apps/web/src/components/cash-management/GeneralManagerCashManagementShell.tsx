import Link from 'next/link';
import { Eye, LockKeyhole } from 'lucide-react';

export function GeneralManagerCashManagementShell({ section, children }: { section: string; children: React.ReactNode }) {
  return <div className="min-h-full bg-[#070d19]">
    <div className="border-b border-white/[0.06] bg-[#0a1220] px-3 py-3 sm:px-6 lg:px-8 print:hidden">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-300" /><span className="truncate">General Manager / Cash Management</span><span className="text-slate-700">/</span> <span className="shrink-0 text-slate-300">{section}</span></div>
        <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300"><Eye className="h-3 w-3" />Read-only analysis</span><Link href="/general-manager/cash-management" className="text-[10px] font-semibold text-slate-500 transition hover:text-white">Back to control center</Link></div>
      </div>
    </div>
    {children}
  </div>;
}
