import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ShieldAlert, Users, Home } from 'lucide-react';
import { startImpersonation } from '@/lib/auth/hq';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function TenantControlPage({
  params
}: {
  params: Promise<{ organizationId: string }>
}) {
  await requireHQAdmin();
  const { organizationId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      properties: true,
      memberships: { include: { user: { select: { id: true, email: true, roles: { include: { role: true } } } } } },
      subscriptions: { include: { items: { include: { price: { include: { product: true } } } } } },
      entitlements: { include: { product: true } }
    }
  }) as any;

  if (!org) notFound();

  const users = org.memberships.map((m: any) => m.user);

  // Handle server action for impersonation inline for simplicity
  async function handleImpersonate(formData: FormData) {
    'use server';
    const targetUserId = formData.get('userId') as string;
    await startImpersonation(targetUserId, 'HQ Admin support session');
    // Redirects should normally happen here, but for now we just rely on standard app behavior
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{org.name}</h1>
        <p className="text-zinc-500 mt-1">Tenant ID: {org.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Properties</CardTitle>
            <Home className="w-4 h-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.properties.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Users</CardTitle>
            <Users className="w-4 h-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Status</CardTitle>
            <ShieldAlert className="w-4 h-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-sm px-3 py-1">Active</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {org.subscriptions.length === 0 ? (
                <p className="text-zinc-500">No active subscriptions.</p>
              ) : (
                <ul className="space-y-4">
                  {org.subscriptions.map((sub: any) => (
                    <li key={sub.id} className="p-4 border rounded-lg flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                      <div>
                        <div className="font-medium">Stripe: {sub.stripeSubscriptionId.slice(0, 12)}...</div>
                        <div className="text-sm text-zinc-500">
                          Renews {format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Badge variant={sub.status === 'ACTIVE' ? 'default' : 'destructive'}>{sub.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entitlements</CardTitle>
            </CardHeader>
            <CardContent>
              {org.entitlements.length === 0 ? (
                <p className="text-zinc-500">No active entitlements.</p>
              ) : (
                <ul className="space-y-3">
                  {org.entitlements.map((ent: any) => (
                    <li key={ent.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div className="font-medium">{ent.product.name} ({ent.productCode})</div>
                      <Badge variant={ent.status === 'ACTIVE' ? 'default' : 'destructive'}>{ent.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Administration & Impersonation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user: any) => (
                  <div key={user.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                        <div className="font-medium text-sm">{user.email}</div>
                      <div className="text-xs text-zinc-500">{user.email} • {user.roles?.[0]?.role?.name || 'User'}</div>
                    </div>
                    <form action={handleImpersonate}>
                      <input type="hidden" name="userId" value={user.id} />
                      <Button variant="outline" size="sm" type="submit">
                        Impersonate
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
