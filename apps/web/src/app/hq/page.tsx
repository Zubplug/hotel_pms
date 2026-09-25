import prisma from '@hotel-pms/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function HQDashboard() {
  await requireHQAdmin();
  const [
    totalOrganizations,
    totalProperties,
    activeSubscriptions,
    activeItems,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.property.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    // Fetch active subscription items and sum manually since Prisma doesn't support nested relation sums
    prisma.subscriptionItem.findMany({
      where: { subscription: { status: 'ACTIVE' } },
      include: { price: true }
    })
  ]);

  const mrrCents = activeItems.reduce((acc, item) => acc + (item.price.interval === 'year' ? Math.round(item.price.amount / 12) : item.price.amount), 0);

  const mrrFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(mrrCents / 100);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Executive Dashboard</h1>
        <p className="text-zinc-500 mt-1">LodgeCore Platform Overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrganizations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProperties}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{mrrFormatted}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
