/**
 * Safely reconcile existing POS menu images into linked Commerce products.
 *
 * This script intentionally does not create Commerce products. It only links
 * a Commerce product when there is exactly one matching POS product within
 * the same property and category name, then copies the POS image.
 *
 * Production usage:
 *   pnpm --filter @hotel-pms/db exec tsx prisma/sync-commerce-pos-images.ts
 */

import prisma from '..';

const normalize = (value: string | null | undefined) =>
  String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

async function main() {
  const commerceProducts = await prisma.commerceProduct.findMany({
    where: { store: { propertyId: { not: null } } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      posProductId: true,
      store: { select: { id: true, slug: true, propertyId: true, targetOutletId: true } },
      category: { select: { name: true } },
    },
  });

  const propertyIds = [...new Set(commerceProducts.map((product) => product.store.propertyId).filter(Boolean))] as string[];
  const posProducts = await prisma.posProduct.findMany({
    where: { propertyId: { in: propertyIds } },
    select: {
      id: true,
      propertyId: true,
      name: true,
      image: true,
      category: { select: { name: true, outletId: true } },
    },
  });

  const candidates = new Map<string, typeof posProducts>();
  for (const product of posProducts) {
    const key = `${product.propertyId}|${product.category.outletId}|${normalize(product.name)}|${normalize(product.category.name)}`;
    const rows = candidates.get(key) || [];
    rows.push(product);
    candidates.set(key, rows);
  }

  let linked = 0;
  let copied = 0;
  let updatedExisting = 0;
  let skippedAmbiguous = 0;
  let skippedMissingImage = 0;

  const posById = new Map(posProducts.map((product) => [product.id, product]));

  for (const commerceProduct of commerceProducts) {
    if (!commerceProduct.store.propertyId) continue;

    if (commerceProduct.posProductId) {
      const source = posById.get(commerceProduct.posProductId);
      if (!source || source.propertyId !== commerceProduct.store.propertyId) continue;
      const imageUrl = source.image?.trim() || null;
      if (commerceProduct.imageUrl !== imageUrl) {
        await prisma.commerceProduct.update({
          where: { id: commerceProduct.id },
          data: { imageUrl, imageUrls: imageUrl ? [imageUrl] : [] },
        });
        updatedExisting += 1;
        if (imageUrl) copied += 1;
      }
      continue;
    }

    const outletMatches = commerceProduct.store.targetOutletId
      ? candidates.get(`${commerceProduct.store.propertyId}|${commerceProduct.store.targetOutletId}|${normalize(commerceProduct.name)}|${normalize(commerceProduct.category.name)}`) || []
      : [];
    const matches = outletMatches.length > 0
      ? outletMatches
      : [...candidates.entries()]
        .filter(([key]) => key.endsWith(`|${normalize(commerceProduct.name)}|${normalize(commerceProduct.category.name)}`) && key.startsWith(`${commerceProduct.store.propertyId}|`))
        .flatMap(([, rows]) => rows);
    if (matches.length !== 1) {
      if (matches.length > 1) skippedAmbiguous += 1;
      continue;
    }

    const posProduct = matches[0];
    await prisma.commerceProduct.update({
      where: { id: commerceProduct.id },
      data: {
        posProductId: posProduct.id,
        ...(posProduct.image?.trim()
          ? { imageUrl: posProduct.image.trim(), imageUrls: [posProduct.image.trim()] }
          : {}),
      },
    });
    linked += 1;
    if (posProduct.image?.trim()) copied += 1;
    else skippedMissingImage += 1;
  }

  console.log(JSON.stringify({
    commerceProducts: commerceProducts.length,
    linked,
    copied,
    updatedExisting,
    skippedAmbiguous,
    skippedMissingImage,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
