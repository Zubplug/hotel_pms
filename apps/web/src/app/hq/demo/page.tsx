import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import DemoConfigurationPanel from './DemoConfigurationPanel';

export const dynamic = 'force-dynamic';

export default async function HQDemoPage() {
  await requireHQAdmin();
  const [configuration, organizations, properties, grantors, activeAccounts] = await Promise.all([
    (prisma as any).demoConfiguration.findUnique({ where: { configKey: 'default' } }),
    prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { OR: [{ isLodgeCoreAdmin: true }, { isSuperAdmin: true }] }, select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: 'asc' } }),
    (prisma as any).demoAccount.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } }),
  ]);

  const websiteOrigin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app';
  return <main className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10"><div className="mx-auto max-w-[1250px] space-y-6"><header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,.14),transparent_36%),#0b1628] p-5 sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300">LodgeCore HQ · platform configuration</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.05em] text-white sm:text-5xl">Public demo access</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Operate a safe, time-limited product tour for prospects without exposing your live hotel operations. Configure the shared demo workspace from one control center.</p></header><DemoConfigurationPanel configuration={configuration ? { enabled: configuration.enabled, organizationId: configuration.organizationId, propertyId: configuration.propertyId, grantorUserId: configuration.grantorUserId, updatedAt: configuration.updatedAt.toISOString() } : null} organizations={organizations} properties={properties.map((item) => ({ id: item.id, name: item.name, organizationId: item.organizationId, organizationName: item.organization.name }))} grantors={grantors.map((item) => ({ id: item.id, name: [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email, email: item.email }))} activeAccounts={activeAccounts} demoUrl={`${websiteOrigin.replace(/\/$/, '')}/demo`} /></div></main>;
}
