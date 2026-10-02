import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import ProductsWorkspace from './ProductsWorkspace';

const monthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });

export default async function HQProductsPage() {
  await requireHQAdmin();

  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [products, plans, subscriptions, invoices, organizations, recentInvoices] = await Promise.all([
    prisma.billingProduct.findMany({
      include: { prices: { orderBy: { amount: 'asc' } }, _count: { select: { entitlements: true, planItems: true, modules: true } } },
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.billingPlan.findMany({ where: { active: true }, include: { items: { include: { product: { select: { id: true, name: true, code: true, prices: { select: { amount: true, interval: true } } } } } } }, orderBy: { displayOrder: 'asc' } }),
    prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED'] } }, include: { plan: { select: { id: true, name: true, code: true, items: { select: { productId: true } } } }, items: { include: { price: { include: { product: { select: { id: true, name: true, code: true } } } } } } } }),
    prisma.billingInvoice.findMany({ where: { createdAt: { gte: since } }, select: { total: true, amountPaid: true, amountDue: true, status: true, currency: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.organization.findMany({ select: { id: true, name: true, createdAt: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } } }),
    prisma.billingInvoice.findMany({ take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, total: true, amountDue: true, status: true, currency: true, createdAt: true, organization: { select: { name: true } } } }),
  ]);

  const activeSubscriptions = subscriptions.filter((subscription) => ['ACTIVE', 'TRIALING'].includes(subscription.status));
  const productUsage = new Map<string, { accounts: Set<string>; quantity: number; mrr: number }>();
  for (const subscription of subscriptions) {
    const isLive = ['ACTIVE', 'TRIALING'].includes(subscription.status);
    if (isLive && subscription.plan) for (const planItem of subscription.plan.items) {
      const current = productUsage.get(planItem.productId) ?? { accounts: new Set<string>(), quantity: 0, mrr: 0 };
      current.accounts.add(subscription.organizationId);
      const planPrice = planItem.product.prices.find((price) => price.interval === 'month') ?? planItem.product.prices.find((price) => price.interval === 'year');
      if (planPrice) current.mrr += planPrice.interval === 'year' ? Math.round(planPrice.amount / 12) : planPrice.amount;
      productUsage.set(planItem.productId, current);
    }
    for (const item of subscription.items) {
      const product = item.price.product;
      const current = productUsage.get(product.id) ?? { accounts: new Set<string>(), quantity: 0, mrr: 0 };
      if (isLive) current.accounts.add(subscription.organizationId);
      current.quantity += item.quantity;
      current.mrr += item.price.interval === 'year' ? Math.round((item.price.amount * item.quantity) / 12) : item.price.amount * item.quantity;
      productUsage.set(product.id, current);
    }
  }

  const totalMrr = activeSubscriptions.reduce((total, subscription) => {
    if (subscription.items.length) return total + subscription.items.reduce((subtotal, item) => subtotal + (item.price.interval === 'year' ? Math.round(item.price.amount / 12) : item.price.amount), 0);
    const planPrice = subscription.plan?.items.find((item) => item.required)?.product.prices.find((price) => price.interval === 'month') ?? subscription.plan?.items.find((item) => item.required)?.product.prices.find((price) => price.interval === 'year');
    return total + (planPrice ? (planPrice.interval === 'year' ? Math.round(planPrice.amount / 12) : planPrice.amount) : 0);
  }, 0);
  const collected = invoices.reduce((total, invoice) => total + invoice.amountPaid, 0);
  const outstanding = invoices.reduce((total, invoice) => total + invoice.amountDue, 0);
  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return { label: monthLabel(date), revenue: 0, invoices: 0 }; });
  for (const invoice of invoices) { const point = monthlyRevenue.find((item, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return date.getFullYear() === invoice.createdAt.getFullYear() && date.getMonth() === invoice.createdAt.getMonth(); }); if (point) { point.revenue += invoice.amountPaid; point.invoices += 1; } }

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    type: product.type,
    active: product.active,
    flutterwaveProductId: product.flutterwaveProductId,
    createdAt: product.createdAt.toISOString(),
    prices: product.prices.map((price) => ({ id: price.id, amount: price.amount, currency: price.currency, interval: price.interval, flutterwavePriceId: price.flutterwavePriceId })),
    adoption: productUsage.get(product.id)?.accounts.size ?? 0,
    quantity: productUsage.get(product.id)?.quantity ?? 0,
    mrr: productUsage.get(product.id)?.mrr ?? 0,
    planCount: product._count.planItems,
    entitlementCount: product._count.entitlements,
    moduleCount: product._count.modules,
  }));

  const planMix = plans.map((plan) => ({ name: plan.name, value: activeSubscriptions.filter((subscription) => subscription.plan?.id === plan.id).length })).filter((plan) => plan.value > 0);
  const statusMix = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED'].map((status) => ({ name: status.replace('_', ' '), value: subscriptions.filter((subscription) => subscription.status === status).length })).filter((status) => status.value > 0);

  return <ProductsWorkspace data={{
    generatedAt: new Date().toISOString(),
    catalog,
    plans: plans.map((plan) => ({ id: plan.id, name: plan.name, code: plan.code, active: plan.active, itemCount: plan.items.length, subscriptionCount: activeSubscriptions.filter((subscription) => subscription.plan?.id === plan.id).length, products: plan.items.map((item) => item.product.name) })),
    monthlyRevenue,
    planMix,
    statusMix,
    recentInvoices: recentInvoices.map((invoice) => ({ ...invoice, createdAt: invoice.createdAt.toISOString(), organizationName: invoice.organization.name })),
    metrics: { totalProducts: products.length, activeProducts: products.length, totalPlans: plans.length, activePlans: plans.length, activeSubscriptions: activeSubscriptions.length, totalSubscriptions: subscriptions.length, totalOrganizations: organizations.length, totalMrr, collected, outstanding, failedInvoices: invoices.filter((invoice) => ['failed', 'uncollectible', 'past_due'].includes(invoice.status.toLowerCase())).length, pricedProducts: products.filter((product) => product.prices.length > 0).length },
  }} />;
}
