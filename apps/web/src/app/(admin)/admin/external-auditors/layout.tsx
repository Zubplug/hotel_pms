import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Archive, ArrowLeft, KeyRound, MailPlus, ShieldCheck } from 'lucide-react';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);

export default async function ExternalAuditorAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = String(session?.user?.role || '').toUpperCase();
  const isSuperAdmin = Boolean(session?.user?.isSuperAdmin);
  if (!session?.user || (!isSuperAdmin && !ADMIN_ROLES.has(role))) redirect('/general-manager');

  return <div className="min-h-screen bg-slate-950 text-slate-200 lg:flex">
    <aside className="hidden w-64 shrink-0 border-r border-white/[.08] bg-[#0b1628] lg:flex lg:flex-col">
      <div className="border-b border-white/[.08] px-5 py-6">
        <Link href="/general-manager" className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back to PMS</Link>
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300 text-slate-950"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-semibold text-white">Auditor administration</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Admin control center</p></div></div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">Governance</p>
        <Link href="/admin/external-auditors" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[.06] hover:text-white"><KeyRound className="h-4 w-4 text-emerald-300" /> Management</Link>
        <Link href="/admin/external-auditors/invite" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[.06] hover:text-white"><MailPlus className="h-4 w-4 text-sky-300" /> Invite auditor</Link>
        <Link href="/admin/external-auditors/final-pack" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[.06] hover:text-white"><Archive className="h-4 w-4 text-violet-300" /> Final-pack sign-off</Link>
      </nav>
      <div className="border-t border-white/[.08] px-5 py-4"><p className="truncate text-xs text-slate-400">{session.user.email}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-slate-600">Administrator access</p></div>
    </aside>
    <main className="min-w-0 flex-1">{children}</main>
  </div>;
}
