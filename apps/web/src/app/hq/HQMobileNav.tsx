'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Activity, Building2, ClipboardCheck, FileText, FlaskConical, Globe, Menu, Network, Package, Shield, Target, X } from 'lucide-react';
import { HQLogoutButton } from './HQLogoutButton';

const nav = [
  { href: '/hq', label: 'Command centre', icon: Activity },
  { href: '/hq/organizations', label: 'Organisations', icon: Building2 },
  { href: '/hq/approvals', label: 'Approval centre', icon: ClipboardCheck },
  { href: '/hq/demo', label: 'Demo access', icon: FlaskConical },
  { href: '/hq/leads', label: 'Sales leads', icon: Target },
  { href: '/hq/products', label: 'Products & pricing', icon: Package },
  { href: '/hq/reach', label: 'Reach network', icon: Network },
  { href: '/hq/custom-domains', label: 'Custom domains', icon: Globe },
  { href: '/hq/custom-websites', label: 'Custom websites', icon: Globe },
  { href: '/hq/invoices', label: 'Invoices', icon: FileText },
  { href: '/hq/activity', label: 'Audit log', icon: Shield },
];

type Admin = { name?: string | null; email?: string | null };

export function HQMobileNav({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = (admin.name || admin.email || 'A').slice(0, 1).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b1628]/95 px-4 shadow-lg shadow-slate-950/20 backdrop-blur-xl lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open HQ navigation" className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 transition hover:bg-white/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
          <Menu className="size-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-300/20"><Shield className="size-4 text-indigo-300" /></div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">LodgeCore</p><p className="truncate text-[9px] font-semibold uppercase tracking-[.18em] text-indigo-300">HQ control plane</p></div>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-semibold text-indigo-200" aria-label={admin.name || admin.email || 'Administrator'}>{initials}</div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="HQ navigation">
          <button type="button" aria-label="Close HQ navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#020713]/75 backdrop-blur-sm" />
          <aside className="relative flex h-full w-[min(86vw,21rem)] flex-col border-r border-white/10 bg-[#0b1628] px-4 py-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-5">
              <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-300/20"><Shield className="size-5 text-indigo-300" /></div><div className="min-w-0"><p className="font-semibold text-white">LodgeCore</p><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-indigo-300">HQ control plane</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[.06] hover:text-white"><X className="size-5" /></button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto py-5" aria-label="HQ sections">
              <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Platform management</p>
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/hq' && pathname.startsWith(`${href}/`));
                return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-indigo-500/15 font-medium text-white ring-1 ring-indigo-400/20' : 'text-slate-400 hover:bg-white/[.05] hover:text-white'}`}><Icon className={`size-4 ${active ? 'text-indigo-300' : 'text-slate-500'}`} />{label}</Link>;
              })}
            </nav>
            <div className="border-t border-white/10 pt-4"><div className="flex items-center gap-3 rounded-xl bg-white/[.04] p-3"><div className="flex size-8 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-semibold text-indigo-200">{initials}</div><div className="min-w-0"><p className="truncate text-xs font-medium text-white">{admin.name || 'HQ administrator'}</p><p className="truncate text-[11px] text-slate-500">{admin.email}</p></div></div><HQLogoutButton /></div>
          </aside>
        </div>
      )}
    </>
  );
}
