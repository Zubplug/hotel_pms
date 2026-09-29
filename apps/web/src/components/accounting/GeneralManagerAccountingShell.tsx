import Link from 'next/link';
import { ArrowUpRight, Eye, LockKeyhole, ShieldCheck } from 'lucide-react';

const sections = [
  ['Overview', '/general-manager/accounting'],
  ['Reports', '/general-manager/accounting/reports'],
  ['Receivables', '/general-manager/accounting/receivables'],
  ['City ledger', '/general-manager/accounting/city-ledger'],
  ['Payables', '/general-manager/accounting/payables'],
  ['Taxes', '/general-manager/accounting/taxes'],
  ['GL integrity', '/general-manager/accounting/gl'],
] as const;

export function GeneralManagerAccountingShell({ section, children }: { section: string; children: React.ReactNode }) {
  return <div className="min-h-full bg-[#070d19]">
    <div className="border-b border-white/[0.07] bg-[linear-gradient(100deg,#0a1423_0%,#0c1729_55%,#10142b_100%)] px-4 py-3 sm:px-6 lg:px-8 print:hidden">
      <div className="mx-auto max-w-[1580px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /></span><span>General Manager / Accounting</span> <span className="text-slate-700">/</span> <span className="text-slate-300">{section}</span></div>
          <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 text-[10px] text-slate-500 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Live property ledger</span><span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-300"><Eye className="h-3 w-3" /> Read-only management analysis</span></div>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-0.5" aria-label="Accounting management sections">{sections.map(([label, href]) => <Link key={href} href={href} className={`group flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${label === section ? 'bg-white/[0.1] text-white shadow-[inset_0_-2px_0_#34d399]' : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-200'}`}>{label}{label === 'Reports' && <ArrowUpRight className="h-3 w-3 opacity-40 transition group-hover:opacity-100" />}</Link>)}</nav>
      </div>
    </div>
    {children}
  </div>;
}
