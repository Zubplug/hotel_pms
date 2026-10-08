import { redirect } from 'next/navigation';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import BillingWorkspace from './BillingWorkspace';

export default async function BillingPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) redirect('/login');

  const [products, properties, requests] = await Promise.all([
    prisma.billingProduct.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }], include: { prices: { orderBy: { amount: 'asc' } } } }),
    prisma.property.findMany({ where: { organizationId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.customDomainRequest.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, select: { id: true, domain: true, propertyId: true, status: true, amount: true, currency: true, billingPriceId: true } }),
  ]);

  return <BillingWorkspace organizationId={organizationId} products={products.map((product) => ({ id: product.id, code: product.code, name: product.name, type: product.type, description: typeof product.metadata === 'object' && product.metadata && 'description' in product.metadata ? String(product.metadata.description) : null, prices: product.prices.map((price) => ({ id: price.id, amount: price.amount, currency: price.currency, interval: price.interval })) }))} properties={properties} requests={requests} />;
}
