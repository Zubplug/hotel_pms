import prisma from '@hotel-pms/db';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function HQOrganizationsPage() {
  await requireHQAdmin();
  const organizations = await prisma.organization.findMany({
    include: {
      properties: { select: { id: true } },
      subscriptions: { select: { status: true } },
      entitlements: { select: { productCode: true, status: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Organizations</h1>
        <p className="text-zinc-500 mt-1">Manage tenant organizations and their billing status.</p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-medium text-zinc-500">Organization</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Properties</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Subscription</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Add-ons</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Created</th>
              <th className="px-6 py-4 font-medium text-zinc-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {organizations.map((org) => {
              const baseSub = org.subscriptions[0];
              const activeAddons = org.entitlements.filter(e => e.status === 'ACTIVE');

              return (
                <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900 dark:text-white">{org.name}</div>
                    <div className="text-zinc-500 text-xs">{org.slug}</div>
                  </td>
                  <td className="px-6 py-4">{org.properties.length}</td>
                  <td className="px-6 py-4">
                    {baseSub ? (
                      <Badge variant={baseSub.status === 'ACTIVE' ? 'default' : 'destructive'}>
                        {baseSub.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">NO PLAN</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {activeAddons.length > 0 ? activeAddons.map(a => (
                        <Badge key={a.productCode} variant="secondary" className="text-xs">
                          {a.productCode}
                        </Badge>
                      )) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {format(new Date(org.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/hq/organizations/${org.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
