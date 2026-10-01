import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { startImpersonation, requireHQAdmin } from '@/lib/auth/hq';

export default async function TenantControlPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await requireHQAdmin();
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      properties: true,
      memberships: {
        include: { user: { select: { id: true, email: true, roles: { include: { role: true } } } } },
      },
      subscriptions: { include: { items: { include: { price: { include: { product: true } } } } } },
      entitlements: { include: { product: true } },
    },
  }) as any;

  if (!org) notFound();

  const users = org.memberships.map((m: any) => m.user);

  async function handleImpersonate(formData: FormData) {
    'use server';
    const targetUserId = formData.get('userId') as string;
    await startImpersonation(targetUserId, 'HQ Admin support session');
  }

  return (
    <div className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px] space-y-8">

        {/* Breadcrumb + Header */}
        <header>
          <Link href="/hq/organizations" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
            ← Organisations
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{org.name}</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">Tenant ID: {org.id}</p>
        </header>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Properties', value: org.properties.length, icon: '⌂', tone: 'indigo' },
            { label: 'Users', value: users.length, icon: '◉', tone: 'sky' },
            { label: 'Entitlements', value: org.entitlements.filter((e: any) => e.status === 'ACTIVE').length, icon: '▤', tone: 'emerald' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl shadow-slate-950/10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[.15em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${item.tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : item.tone === 'sky' ? 'bg-sky-400/10 text-sky-300' : 'bg-indigo-400/10 text-indigo-300'}`}>
                  <span aria-hidden="true" className="text-lg">{item.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Subscriptions */}
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5">
            <p className="mb-4 text-sm font-semibold text-white">Subscriptions</p>
            {org.subscriptions.length === 0 ? (
              <p className="text-sm text-slate-500">No active subscriptions.</p>
            ) : (
              <ul className="space-y-3">
                {org.subscriptions.map((sub: any) => {
                  const isActive = sub.status === 'ACTIVE' || sub.status === 'TRIALING';
                  return (
                    <li key={sub.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.025] px-4 py-3">
                      <div>
                        <p className="font-mono text-xs text-slate-300">{sub.stripeSubscriptionId.slice(0, 20)}…</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {sub.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Entitlements */}
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5">
            <p className="mb-4 text-sm font-semibold text-white">Entitlements</p>
            {org.entitlements.length === 0 ? (
              <p className="text-sm text-slate-500">No active entitlements.</p>
            ) : (
              <ul className="divide-y divide-white/[.06]">
                {org.entitlements.map((ent: any) => {
                  const isActive = ent.status === 'ACTIVE';
                  return (
                    <li key={ent.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{ent.product.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{ent.productCode}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-400'
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {ent.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Properties */}
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5">
            <p className="mb-4 text-sm font-semibold text-white">Properties</p>
            {org.properties.length === 0 ? (
              <p className="text-sm text-slate-500">No properties configured.</p>
            ) : (
              <ul className="divide-y divide-white/[.06]">
                {org.properties.map((prop: any) => (
                  <li key={prop.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{prop.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{prop.slug}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      prop.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-400'
                    }`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {prop.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* User Administration & Impersonation */}
          <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5">
            <p className="mb-4 text-sm font-semibold text-white">User administration &amp; impersonation</p>
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              <ul className="divide-y divide-white/[.06]">
                {users.map((user: any) => (
                  <li key={user.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{user.email}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {user.roles?.[0]?.role?.name || 'User'}
                      </p>
                    </div>
                    <form action={handleImpersonate}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 text-xs font-medium text-amber-200 transition hover:bg-amber-300/[.12] hover:text-amber-100"
                      >
                        Impersonate
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
