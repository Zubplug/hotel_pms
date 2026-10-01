import { requireHQAdmin } from '@/lib/auth/hq';
import Link from 'next/link';
import { Shield, Building2, Package, Activity, FileText } from 'lucide-react';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { HQLogoutButton } from './HQLogoutButton';

export default async function HQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure the user is a LodgeCore Admin.
  // This physically blocks normal hotel users from loading anything inside (hq)
  const admin = await requireHQAdmin();
  const pathname = (await headers()).get('x-pathname') || '';
  const nav = [
    { href: '/hq', label: 'Command centre', icon: Activity },
    { href: '/hq/organizations', label: 'Organisations', icon: Building2 },
    { href: '/hq/products', label: 'Products & pricing', icon: Package },
    { href: '/hq/invoices', label: 'Invoices', icon: FileText },
    { href: '/hq/activity', label: 'Audit log', icon: Shield },
  ];

  return (
    <div className="flex h-screen bg-[#07111f] text-slate-200">
      {/* HQ Sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0b1628] text-slate-300 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-300/20"><Shield className="size-5 text-indigo-300" /></div>
            <div><p className="font-semibold tracking-tight text-white">LodgeCore</p><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-indigo-300">HQ control plane</p></div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <p className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Platform management</p>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/hq' && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-indigo-500/15 font-medium text-white ring-1 ring-indigo-400/20' : 'text-slate-400 hover:bg-white/[.05] hover:text-white'}`}><Icon className={`size-4 ${active ? 'text-indigo-300' : 'text-slate-500'}`} />{label}</Link>;
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[.04] p-3"><div className="flex size-8 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-semibold text-indigo-200">{(admin.name || admin.email || 'A').slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-medium text-white">{admin.name || 'HQ administrator'}</p><p className="truncate text-[11px] text-slate-500">{admin.email}</p></div></div>
          <HQLogoutButton />
          <p className="mt-4 px-1 text-[10px] uppercase tracking-[.18em] text-slate-600">LodgeCore Control Plane · v1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-8 text-slate-500">Loading control plane…</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
