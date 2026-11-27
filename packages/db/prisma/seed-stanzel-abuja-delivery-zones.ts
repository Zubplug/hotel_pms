/**
 * Configure Stanzel's initial Abuja delivery estimates.
 *
 * These are customer-facing estimates for Bolt-bike dispatch from:
 * Plot C103, A Close, off 1st Avenue, Gwarinpa Estate, Abuja.
 * They are intentionally conservative distance bands, not live Bolt quotes.
 * Replace/update them when a Bolt Business quote API is connected.
 *
 * Idempotent: re-running updates the named zones instead of creating duplicates.
 * Run after migration 20261127170000_add_commerce_delivery_zone_matching:
 *   pnpm --filter @hotel-pms/db exec tsx prisma/seed-stanzel-abuja-delivery-zones.ts
 */

import prisma from '..';

const STORE_SLUG = 'stanzel-grand';

const zones = [
  {
    name: 'Gwarinpa & Life Camp',
    deliveryFee: 1500,
    estimatedMinutes: 35,
    matchKeywords: ['gwarinpa', 'life camp', 'lifecamp', 'cadastral zone b', 'cadastral zone c'],
  },
  {
    name: 'Jabi, Utako & Wuse',
    deliveryFee: 2500,
    estimatedMinutes: 50,
    matchKeywords: ['jabi', 'utako', 'wuse', 'wuse 2', 'wuse ii', 'katampe'],
  },
  {
    name: 'Maitama, Central Area & Asokoro',
    deliveryFee: 3500,
    estimatedMinutes: 60,
    matchKeywords: ['maitama', 'central area', 'central business district', 'cbd', 'asokoro', 'garki'],
  },
  {
    name: 'Airport Road & Lugbe',
    deliveryFee: 5000,
    estimatedMinutes: 75,
    matchKeywords: ['airport road', 'lugbe', 'fha lugbe', 'trademore'],
  },
  {
    name: 'Kubwa & Bwari',
    deliveryFee: 6500,
    estimatedMinutes: 90,
    matchKeywords: ['kubwa', 'bwari', 'dutse alhaji', 'dawaki', 'karu'],
  },
  {
    name: 'Gwagwalada & Abuja Outer Areas',
    deliveryFee: 7500,
    estimatedMinutes: 120,
    matchKeywords: ['gwagwalada', 'kuje', 'nyanya', 'mararaba', 'suleja'],
  },
] as const;

async function main() {
  const store = await prisma.commerceStore.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true, name: true },
  });

  if (!store) throw new Error(`Commerce store not found: ${STORE_SLUG}`);

  await prisma.commerceStore.update({
    where: { id: store.id },
    data: { deliveryEnabled: true, deliveryFeeMode: 'ZONE' },
  });

  for (const zone of zones) {
    const existing = await prisma.commerceDeliveryZone.findFirst({
      where: { storeId: store.id, name: zone.name },
      select: { id: true },
    });

    const data = {
      deliveryFee: zone.deliveryFee,
      estimatedMinutes: zone.estimatedMinutes,
      matchKeywords: [...zone.matchKeywords],
      postalCodes: [] as string[],
      isActive: true,
    };

    if (existing) {
      await prisma.commerceDeliveryZone.update({ where: { id: existing.id }, data });
    } else {
      await prisma.commerceDeliveryZone.create({ data: { storeId: store.id, name: zone.name, ...data } });
    }
  }

  console.log(`Configured ${zones.length} Abuja delivery areas for ${store.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
