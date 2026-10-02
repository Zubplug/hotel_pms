import { PrismaClient, Prisma } from '@prisma/client';
import { catalogPlans, catalogProducts, CATALOG_VERSION, planPrices } from './catalog';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  console.log(`Seeding billing catalogue v${CATALOG_VERSION} on ${new URL(process.env.DATABASE_URL).hostname}`);

  await prisma.$transaction(async (tx) => {
    const products = new Map<string, { id: string }>();
    for (const item of catalogProducts) {
      const product = await tx.billingProduct.upsert({
        where: { code: item.code },
        update: { name: item.name, type: item.type, active: item.active, catalogVersion: CATALOG_VERSION, metadata: item.metadata as Prisma.InputJsonValue },
        create: { code: item.code, name: item.name, type: item.type, active: item.active, catalogVersion: CATALOG_VERSION, metadata: item.metadata as Prisma.InputJsonValue },
        select: { id: true },
      });
      products.set(item.code, product);
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

    for (const price of planPrices) {
      const product = products.get(price.code);
      if (!product) throw new Error(`Missing pricing product ${price.code}`);
      for (const [interval, amount] of [['month', price.month], ['year', price.year]] as const) {
        const existing = await tx.billingPrice.findFirst({ where: { productId: product.id, interval, catalogVersion: CATALOG_VERSION } });
        if (existing) await tx.billingPrice.update({ where: { id: existing.id }, data: { amount, currency: 'ngn' } });
        else await tx.billingPrice.create({ data: { productId: product.id, interval, amount, currency: 'ngn', catalogVersion: CATALOG_VERSION } });
      }
    }
  });
  console.log(`Seeded ${catalogProducts.length} products and ${catalogPlans.length} plans.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
