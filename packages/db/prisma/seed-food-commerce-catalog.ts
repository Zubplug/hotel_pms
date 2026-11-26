/**
 * seed-food-commerce-catalog.ts
 *
 * Upserts all ADDON_FOOD_* BillingProduct and BillingPrice rows.
 * Run after adding Food Commerce add-ons to catalog.ts.
 *
 * Usage:
 *   pnpm --filter @hotel-pms/db tsx prisma/seed-food-commerce-catalog.ts
 */

import prisma from '..';
import { Prisma } from '@prisma/client';
import { addOnPrices, CATALOG_VERSION, catalogProducts } from './catalog';

const FOOD_COMMERCE_CODES = [
  'ADDON_FOOD_COMMERCE',
  'ADDON_FOOD_STANDALONE',
  'ADDON_FOOD_DELIVERY',
  'ADDON_FOOD_MEAL_PASS',
  'ADDON_FOOD_ANALYTICS',
  'ADDON_FOOD_NETWORK',
] as const;

async function main() {
  console.log('🍽️  Seeding Food Commerce billing catalog...\n');

  for (const code of FOOD_COMMERCE_CODES) {
    const def = catalogProducts.find((p) => p.code === code);
    if (!def) {
      console.warn(`⚠️  Catalog definition not found for ${code} — skipping.`);
      continue;
    }

    const product = await prisma.billingProduct.upsert({
      where: { code },
      update: {
        name: def.name,
        type: def.type,
        active: def.active,
        catalogVersion: CATALOG_VERSION,
        metadata: def.metadata as Prisma.InputJsonValue,
      },
      create: {
        code: def.code,
        name: def.name,
        type: def.type,
        active: def.active,
        catalogVersion: CATALOG_VERSION,
        metadata: def.metadata as Prisma.InputJsonValue,
      },
    });

    console.log(`✅  BillingProduct: ${code} (id: ${product.id})`);

    // Seed monthly and annual prices (skip ADDON_FOOD_NETWORK — not sellable yet)
    const priceDef = addOnPrices.find((p) => p.code === code);
    if (!priceDef) {
      console.log(`    ↳ No price defined — skipping BillingPrice rows.`);
      continue;
    }

    for (const interval of ['month', 'year'] as const) {
      const amount = interval === 'month' ? priceDef.month : priceDef.year;
      await prisma.billingPrice.upsert({
        where: {
          productId_interval_catalogVersion: {
            productId: product.id,
            interval,
            catalogVersion: CATALOG_VERSION,
          },
        },
        update: { amount, currency: priceDef.currency },
        create: {
          productId: product.id,
          amount,
          currency: priceDef.currency,
          interval,
          catalogVersion: CATALOG_VERSION,
        },
      });
      console.log(
        `    ↳ BillingPrice [${interval}]: ${(amount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}`,
      );
    }
  }

  console.log('\n✅  Food Commerce catalog seeded successfully.');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
