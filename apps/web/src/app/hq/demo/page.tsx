import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { saveDemoConfiguration } from './actions';

export const dynamic = 'force-dynamic';

export default async function HQDemoPage() {
  await requireHQAdmin();
  const [configuration, organizations, properties, grantors] = await Promise.all([
    (prisma as any).demoConfiguration.findUnique({ where: { configKey: 'default' } }),
    prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { OR: [{ isLodgeCoreAdmin: true }, { isSuperAdmin: true }] }, select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: 'asc' } }),
  ]);

  return <main className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
    <div className="mx-auto max-w-4xl space-y-6">
      <header><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-indigo-300">LodgeCore HQ · platform configuration</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Public demo access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose the shared organization and property used by temporary demo accounts. Accounts expire automatically after 24 hours.</p></header>
      <form action={saveDemoConfiguration} className="space-y-6 rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-xl sm:p-7">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4"><span><span className="block text-sm font-semibold text-white">Public demo access</span><span className="mt-1 block text-xs text-slate-500">Visitors can request temporary role-based credentials.</span></span><input name="enabled" type="checkbox" defaultChecked={configuration?.enabled === true} className="size-5 accent-indigo-500" /></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Demo organization<select name="organizationId" required defaultValue={configuration?.organizationId || ''} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#0b1628] px-3 py-3 text-sm text-white"><option value="">Select organization</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-xs text-slate-400">Demo property<select name="propertyId" required defaultValue={configuration?.propertyId || ''} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#0b1628] px-3 py-3 text-sm text-white"><option value="">Select property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.organization.name}</option>)}</select></label>
          <label className="text-xs text-slate-400 sm:col-span-2">Grantor HQ administrator<select name="grantorUserId" required defaultValue={configuration?.grantorUserId || ''} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#0b1628] px-3 py-3 text-sm text-white"><option value="">Select grantor</option>{grantors.map((item) => <option key={item.id} value={item.id}>{[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email} · {item.email}</option>)}</select></label>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5"><p className="text-xs leading-5 text-slate-500">The selected property and organization are never created or deleted by the public demo flow.</p><button type="submit" className="rounded-xl bg-indigo-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-indigo-400">Save demo configuration</button></div>
      </form>
    </div>
  </main>;
}
