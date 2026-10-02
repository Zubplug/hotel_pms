import { Prisma, PrismaClient } from '@prisma/client';
import { catalogPlans, catalogProducts, CATALOG_VERSION, legacyProductCodes, legacyToCanonical, planPrices } from './catalog';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (process.env.APPLY_PRICING_CATALOG !== '1') throw new Error('Refusing to write catalogue. Set APPLY_PRICING_CATALOG=1 for the reviewed production sync.');
  console.log(`Syncing versioned pricing catalogue v${CATALOG_VERSION} on ${new URL(process.env.DATABASE_URL).hostname}`);

  await prisma.$transaction(async (tx) => {
    const products = new Map<string, { id: string }>();
    for (const item of catalogProducts) {
      products.set(item.code, await tx.billingProduct.upsert({
        where: { code: item.code },
        update: { name: item.name, type: item.type, active: item.active, catalogVersion: CATALOG_VERSION, metadata: item.metadata as Prisma.InputJsonValue },
        create: { code: item.code, name: item.name, type: item.type, active: item.active, catalogVersion: CATALOG_VERSION, metadata: item.metadata as Prisma.InputJsonValue },
        select: { id: true },
      }));
    }

    for (const price of planPrices) {
      const product = products.get(price.code)!;
      for (const [interval, amount] of [['month', price.month], ['year', price.year]] as const) {
        const existing = await tx.billingPrice.findFirst({ where: { productId: product.id, interval, catalogVersion: CATALOG_VERSION } });
        if (existing) await tx.billingPrice.update({ where: { id: existing.id }, data: { amount, currency: 'ngn' } });
        else await tx.billingPrice.create({ data: { productId: product.id, interval, amount, currency: 'ngn', catalogVersion: CATALOG_VERSION } });
      }
    }

    for (const definition of catalogPlans) {
      const plan = await tx.billingPlan.upsert({
        where: { code: definition.code },
        update: { name: definition.name, description: definition.description, displayOrder: definition.displayOrder, metadata: definition.metadata as Prisma.InputJsonValue, active: true },
        create: { code: definition.code, name: definition.name, description: definition.description, displayOrder: definition.displayOrder, metadata: definition.metadata as Prisma.InputJsonValue, active: true },
      });
      for (const item of definition.products) {
        const product = products.get(item.code);
        if (!product) throw new Error(`Missing catalogue product ${item.code}`);
        await tx.billingPlanItem.upsert({
          where: { planId_productId: { planId: plan.id, productId: product.id } },
          update: { required: item.required, includedQty: item.quantity },
          create: { planId: plan.id, productId: product.id, required: item.required, includedQty: item.quantity },
        });
      }
    }

    for (const legacyCode of legacyProductCodes) {
      const legacyProduct = await tx.billingProduct.findUnique({ where: { code: legacyCode }, select: { id: true } });
      if (!legacyProduct) continue;
      await tx.billingPlanItem.deleteMany({ where: { productId: legacyProduct.id } });
      const canonicalCode = legacyToCanonical[legacyCode];
      const legacyEntitlements = await tx.entitlement.findMany({ where: { productCode: legacyCode } });
      for (const entitlement of legacyEntitlements) {
        const scopeKey = `${entitlement.organizationId}:${entitlement.propertyId ?? '*'}:${canonicalCode}`;
        const existing = await tx.entitlement.findUnique({ where: { scopeKey } });
        if (existing) {
          await tx.entitlement.update({ where: { id: entitlement.id }, data: { status: 'SUSPENDED', suspendedAt: entitlement.suspendedAt ?? new Date(), suspensionReason: `Migrated to ${canonicalCode}` } });
        } else {
          await tx.entitlement.update({ where: { id: entitlement.id }, data: { productCode: canonicalCode, scopeKey, metadata: { ...(typeof entitlement.metadata === 'object' && entitlement.metadata ? entitlement.metadata : {}), migratedFrom: legacyCode } as Prisma.InputJsonValue } });
        }
      }
      await tx.billingProduct.update({ where: { id: legacyProduct.id }, data: { active: false } });
    }
  }, { maxWait: 30000, timeout: 120000 });
  console.log('Pricing catalogue synchronized. Existing subscription IDs and invoices were preserved.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
