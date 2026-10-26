import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ShieldAlert, Home } from 'lucide-react';
import { requireHQAdmin } from '@/lib/auth/hq';
import { saveOrganizationDiscount } from '../actions';

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
      subscriptions: { include: { items: { include: { price: { include: { product: true } } } } } },
      entitlements: { include: { product: true } }
    }
  }) as any;

  if (!org) notFound();

  const [discountPlans, discountAddons, organizationDiscounts] = await Promise.all([
    prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.billingProduct.findMany({ where: { active: true, type: 'ADDON' }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.organizationBillingDiscount.findMany({ where: { organizationId, active: true }, include: { plan: { select: { name: true, code: true } }, product: { select: { name: true, code: true } } }, orderBy: { createdAt: 'desc' } }),
  ]);

  async function handleDiscount(formData: FormData) {
    'use server';
    await saveOrganizationDiscount(formData);
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{org.name}</h1>
        <p className="text-zinc-500 mt-1">Tenant ID: {org.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <CardTitle className="text-sm font-medium text-zinc-500">Status</CardTitle>
            <ShieldAlert className="w-4 h-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-sm px-3 py-1">Active</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commercial discounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-zinc-500">Set a percentage discount for this organisation’s future plan or add-on checkout. Existing invoices are not changed.</p>
              <form action={handleDiscount} className="space-y-3">
                <input type="hidden" name="organizationId" value={organizationId} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">Target type<select name="targetType" required className="mt-1 w-full rounded-md border bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="PLAN">Subscription plan</option><option value="ADDON">Add-on</option></select></label>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">Discount percentage<input name="percentage" required type="number" min="0.01" max="99.99" step="0.01" placeholder="10" className="mt-1 w-full rounded-md border bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
                </div>
                <label className="block text-sm text-zinc-600 dark:text-zinc-400">Plan or add-on ID<select name="targetId" required className="mt-1 w-full rounded-md border bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><optgroup label="Plans">{discountPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</optgroup><optgroup label="Add-ons">{discountAddons.map((addon) => <option key={addon.id} value={addon.id}>{addon.name} · {addon.code}</option>)}</optgroup></select></label>
                <Button type="submit" size="sm">Save discount</Button>
              </form>
              <div className="mt-5 space-y-2 border-t pt-4 dark:border-zinc-800">{organizationDiscounts.length ? organizationDiscounts.map((discount) => <div key={discount.id} className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 p-2 text-sm dark:bg-zinc-900"><span>{discount.plan?.name || discount.product?.name}</span><strong className="text-emerald-600">{Number(discount.percentage)}% off</strong></div>) : <p className="text-xs text-zinc-500">No organisation-specific discounts configured.</p>}</div>
            </CardContent>
          </Card>
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
                        <div className="font-medium">Flutterwave: {sub.flutterwaveSubscriptionId.slice(0, 12)}...</div>
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

      </div>
    </div>
  );
}
