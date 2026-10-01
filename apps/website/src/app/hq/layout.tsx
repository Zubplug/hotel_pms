import { requireHQAdmin } from '@/lib/auth/hq';
import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { HQLogoutButton } from './HQLogoutButton';
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  FileText,
  Activity,
  Shield,
} from 'lucide-react';

const NAV = [
  { href: '/hq',                 label: 'Command centre',   icon: LayoutDashboard },
  { href: '/hq/organizations',   label: 'Organisations',    icon: Building2 },
  { href: '/hq/leads',           label: 'Sales leads',      icon: Users },
  { href: '/hq/products',        label: 'Products & pricing', icon: Package },
  { href: '/hq/invoices',        label: 'Invoices',         icon: FileText },
  { href: '/hq/activity',        label: 'Audit log',        icon: Activity },
];

export default async function HQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireHQAdmin();
  const pathname = (await headers()).get('x-pathname') || '';

  const userDisplay = admin.name || admin.email || 'HQ Admin';
  const initials = userDisplay
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('') || 'HQ';

  const Sidebar = () => (
    <div className="flex h-full flex-col bg-[#0b1120]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 shadow-lg shadow-indigo-900/40">
          <Shield className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold tracking-wide text-white">LodgeCore</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-indigo-400">
            HQ Control Plane
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          Platform management
        </div>
        <div className="space-y-0.5">
          {NAV.map(({ href, label }) => {
            const active =
              pathname === href ||
              (href !== '/hq' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {label}
                {active && (
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/20 text-sm font-semibold text-indigo-300">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-slate-200">
              {userDisplay}
            </span>
            <span className="text-[10px] font-medium tracking-wide text-indigo-400">
              HQ Administrator
            </span>
          </div>
        </div>
        <HQLogoutButton />
      </div>
    </div>
  );

  return (
    <div className="hq-root flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 lg:block">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center border-b border-white/5 bg-slate-950 px-6">
          <p className="text-sm font-medium text-slate-400">
            HQ Control Plane Workspace
          </p>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-64 p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-sm text-slate-400 tracking-wide">Loading control plane…</p>
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
