import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function HQOrganizationsPage() {
  await requireHQAdmin();
  const organizations = await prisma.organization.findMany({
    include: {
      properties: { select: { id: true, isActive: true } },
      subscriptions: { select: { status: true } },
      entitlements: { select: { productCode: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px] space-y-8">
        {/* Page header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-[.18em] text-indigo-300">Platform management</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Organisations</h1>
          <p className="mt-2 text-sm text-slate-400">
            All tenant organisations, their properties, billing status, and active add-ons.
          </p>
        </header>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101b2f]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.15em] text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Organisation</th>
                <th className="px-6 py-4 font-medium">Properties</th>
                <th className="px-6 py-4 font-medium">Subscription</th>
                <th className="px-6 py-4 font-medium">Add-ons</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {organizations.map((org) => {
                const baseSub = org.subscriptions[0];
                const subStatus = baseSub?.status || 'NO_PLAN';
                const activeAddons = org.entitlements.filter((e) => e.status === 'ACTIVE');
                const isHealthy = subStatus === 'ACTIVE' || subStatus === 'TRIALING';

                return (
                  <tr key={org.id} className="transition hover:bg-white/[.025]">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{org.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{org.slug}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{org.properties.length}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isHealthy
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : subStatus === 'NO_PLAN'
                          ? 'bg-slate-400/10 text-slate-400'
                          : 'bg-rose-400/10 text-rose-300'
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {subStatus === 'NO_PLAN' ? 'No plan' : subStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {activeAddons.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {activeAddons.map((a) => (
                            <span key={a.productCode} className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                              {a.productCode}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(org.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/hq/organizations/${org.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[.08] hover:text-white"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {organizations.length === 0 && (
            <p className="p-12 text-center text-sm text-slate-500">No organisations have been created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
