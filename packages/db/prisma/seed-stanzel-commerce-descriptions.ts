/**
 * Populate missing Stanzel Commerce menu copy.
 *
 * This is intentionally idempotent and only fills empty descriptions. It
 * does not change names, prices, availability, images, or existing copy.
 *
 * Usage against production:
 *   pnpm --filter @hotel-pms/db exec tsx prisma/seed-stanzel-commerce-descriptions.ts
 */

import prisma from '..';

const STORE_SLUG = 'stanzel-grand';

const categoryDescriptions: Record<string, string> = {
  'Nigerian Main Course': 'Classic Nigerian favourites prepared to order with generous, satisfying portions.',
  'Special Orders': 'Made-to-order selections for guests looking for something special from the kitchen.',
  'Rice & Pasta': 'Comforting rice and pasta dishes prepared with flavourful sauces and carefully selected accompaniments.',
  'Nigerian Extras (Sides & Add-ons)': 'Traditional sides and add-ons to complete your meal or build a plate to your taste.',
  'Continental & Breakfast': 'Familiar continental favourites and breakfast selections served with Stanzel hospitality.',
  'Desserts & Snacks': 'Sweet treats and light bites for a relaxed finish or an easy moment between meals.',
  Salads: 'Freshly prepared salads and lighter selections for a crisp, balanced choice.',
  'Nigerian Hot Starter': 'Warm Nigerian starters designed to begin your meal with rich local flavour.',
  'Wines & Champagnes': 'A considered selection of wines and champagnes for relaxed dining and celebrations.',
  'Spirits & Rum': 'Curated spirits and rum selections from the Stanzel bar collection.',
  'Soft Drinks & Water': 'Refreshing soft drinks and bottled water served chilled where available.',
  'Beers & Ciders (Lager)': 'A selection of beers and ciders, served chilled for easy outdoor and indoor enjoyment.',
  'Whiskey, Brandy, Gin & Vodka': 'Recognised whiskey, brandy, gin and vodka selections from our bar menu.',
  Liqueurs: 'A selection of liqueurs suited to relaxed sipping, cocktails and after-dinner service.',
};

function productDescription(productName: string, categoryName: string): string {
  const name = productName.trim();

  if (categoryName === 'Nigerian Main Course') {
    return `${name} — a richly satisfying Nigerian classic, freshly prepared in the Stanzel kitchen for a memorable meal.`;
  }
  if (categoryName === 'Special Orders') {
    return `${name} — a distinctive kitchen selection prepared to order for guests who want something truly special.`;
  }
  if (categoryName === 'Rice & Pasta') {
    return `${name} — a comforting Stanzel favourite, prepared with generous flavour and served fresh from the kitchen.`;
  }
  if (categoryName === 'Nigerian Extras (Sides & Add-ons)') {
    return `${name} — the perfect finishing touch to complete your meal or create a plate exactly as you like it.`;
  }
  if (categoryName === 'Continental & Breakfast') {
    return `${name} — a fresh, satisfying choice for an easy breakfast, relaxed brunch or light meal.`;
  }
  if (categoryName === 'Desserts & Snacks') {
    return `${name} — a delightful sweet treat or light bite for a relaxed moment at Stanzel.`;
  }
  if (categoryName === 'Salads') {
    return `${name} — a crisp, refreshing and balanced selection for a lighter dining experience.`;
  }
  if (categoryName === 'Nigerian Hot Starter') {
    return `${name} — a warming Nigerian starter with inviting local character, prepared to begin your meal beautifully.`;
  }
  if (categoryName === 'Wines & Champagnes') {
    return `${name} — a considered wine and champagne selection, perfect for relaxed dining, toasting and special moments.`;
  }
  if (categoryName === 'Spirits & Rum') {
    return `${name} — a refined spirit selection from the Stanzel bar, ready for an easy evening or a celebratory pour.`;
  }
  if (categoryName === 'Soft Drinks & Water') {
    return `${name} — a refreshing non-alcoholic choice to enjoy chilled with your meal or throughout the day.`;
  }
  if (categoryName === 'Beers & Ciders (Lager)') {
    return `${name} — a chilled beer and cider selection made for relaxed afternoons, good company and easy outdoor service.`;
  }
  if (categoryName === 'Whiskey, Brandy, Gin & Vodka') {
    return `${name} — a premium bar selection for a polished pour, an unhurried evening or a memorable celebration.`;
  }
  if (categoryName === 'Liqueurs') {
    return `${name} — a smooth liqueur selection for relaxed sipping, cocktails or an elegant after-dinner finish.`;
  }

  return `${name}, selected from the Stanzel food and beverage menu.`;
}

async function main() {
  const store = await prisma.commerceStore.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true, name: true },
  });

  if (!store) throw new Error(`Commerce store not found: ${STORE_SLUG}`);

  const categories = await prisma.commerceCategory.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, description: true },
  });

  const products = await prisma.commerceProduct.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, description: true, categoryId: true },
  });

  const categoryById = new Map(categories.map(category => [category.id, category]));
  const operations = [
    ...categories
      .filter(category => !category.description?.trim() && categoryDescriptions[category.name])
      .map(category => prisma.commerceCategory.update({
        where: { id: category.id },
        data: { description: categoryDescriptions[category.name] },
      })),
    ...products
      .filter(product => !product.description?.trim())
      .map(product => {
        const category = categoryById.get(product.categoryId);
        return prisma.commerceProduct.update({
          where: { id: product.id },
          data: {
            description: productDescription(product.name, category?.name ?? ''),
          },
        });
      }),
  ];

  await prisma.$transaction(operations, { maxWait: 10_000, timeout: 60_000 });

  console.log(`Updated ${categories.filter(category => !category.description?.trim() && categoryDescriptions[category.name]).length} categories and ${products.filter(product => !product.description?.trim()).length} products for ${store.name}.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
