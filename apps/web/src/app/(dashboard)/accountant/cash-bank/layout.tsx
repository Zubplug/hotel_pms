import Link from 'next/link';
import { ArrowLeft, Banknote, BriefcaseBusiness, FileCheck2, Landmark, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';

const sections = [
  { href: '/accountant/cash-bank', label: 'Treasury overview', icon: WalletCards },
  { href: '/accountant/cash-bank/deposits', label: 'Deposits', icon: Landmark },
  { href: '/accountant/cash-bank/expenses', label: 'Cash expenses', icon: ReceiptText },
  { href: '/accountant/cash-bank/handovers', label: 'Handovers', icon: Banknote },
];

export default function AccountantCashBankLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#08111f]">
      <div className="border-b border-white/10 bg-[#0b1628]/95 px-4 py-3 text-slate-200 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1540px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/accountant/cash-bank" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/[.08] hover:text-white" aria-label="Back to cash and bank overview">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-cyan-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-300">Accountant workspace</p><p className="text-sm font-semibold text-white">Cash, custody &amp; banking controls</p></div></div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Live operational subledger · controlled postings</div>
        </div>
      </div>
      <nav className="border-b border-white/10 bg-[#0a1424] px-4 sm:px-6 lg:px-8" aria-label="Cash and bank sections">
        <div className="mx-auto flex max-w-[1540px] gap-1 overflow-x-auto py-2">
          {sections.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[.07] hover:text-white">
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
          <span className="ml-auto hidden items-center gap-2 px-3 py-2 text-xs text-slate-600 lg:inline-flex"><FileCheck2 className="h-3.5 w-3.5" />GL-controlled workflow</span>
        </div>
      </nav>
      <div className="relative overflow-hidden"><div className="pointer-events-none absolute -right-32 top-0 h-80 w-80 rounded-full bg-cyan-400/[.05] blur-3xl" /><div className="relative">{children}</div></div>
    </div>
  );
}
