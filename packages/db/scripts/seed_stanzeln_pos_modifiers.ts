import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Upgrading Nigerian Main Course to use Modifiers...');

  const property = await prisma.property.findFirst();
  if (!property) throw new Error('No property found in production.');

  const outlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id }
  });
  if (!outlet) throw new Error('No outlet found.');

  // Find the 'Nigerian Main Course' category
  const category = await prisma.productCategory.findFirst({
    where: { name: 'Nigerian Main Course' }
  });

  if (!category) {
    throw new Error("Category 'Nigerian Main Course' not found.");
  }

  // 1. Delete existing items in Nigerian Main Course to replace them with Modifier-based items
  const existingItems = await prisma.posProduct.findMany({
    where: { categoryId: category.id }
  });

  for (const item of existingItems) {
    // delete any modifiers first if they exist
    await prisma.posProductModifier.deleteMany({
      where: { productId: item.id }
    });
    await prisma.posProduct.delete({
      where: { id: item.id }
    });
  }

  // 2. Create the streamlined base items
  const newItems = [
    {
      name: 'Egusi Soup Meal',
      price: 8500,
      modifiers: [
        { name: 'Semo', priceAdjustment: 0 },
        { name: 'Garri', priceAdjustment: 0 },
        { name: 'Pando', priceAdjustment: 1000 },
        { name: 'Wheat', priceAdjustment: 1000 },
        { name: 'Goat Meat', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 0 },
        { name: 'Beef', priceAdjustment: 0 },
        { name: 'Catfish', priceAdjustment: 1000 },
      ]
    },
    {
      name: 'Ogbono Soup Meal',
      price: 8500,
      modifiers: [
        { name: 'Semo', priceAdjustment: 0 },
        { name: 'Garri', priceAdjustment: 0 },
        { name: 'Pando', priceAdjustment: 1000 },
        { name: 'Wheat', priceAdjustment: 1000 },
        { name: 'Goat Meat', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 0 },
        { name: 'Beef', priceAdjustment: 0 },
        { name: 'Catfish', priceAdjustment: 1000 },
      ]
    },
    {
      name: 'Vegetable Soup Meal',
      price: 9000,
      modifiers: [
        { name: 'Semo', priceAdjustment: 0 },
        { name: 'Garri', priceAdjustment: 0 },
        { name: 'Pando', priceAdjustment: 500 },
        { name: 'Wheat', priceAdjustment: 500 },
        { name: 'Goat Meat', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 0 },
        { name: 'Beef', priceAdjustment: 0 },
        { name: 'Catfish', priceAdjustment: 500 },
      ]
    },
    {
      name: 'Bitterleaf Soup Meal',
      price: 9500,
      modifiers: [
        { name: 'Semo', priceAdjustment: 0 },
        { name: 'Garri', priceAdjustment: 0 },
        { name: 'Pando', priceAdjustment: 0 },
        { name: 'Wheat', priceAdjustment: 0 },
        { name: 'Goat Meat', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 0 },
        { name: 'Beef', priceAdjustment: 0 },
        { name: 'Catfish', priceAdjustment: 0 },
      ]
    },
    {
      name: 'Rice Meal',
      price: 7500, // Base price is Chicken
      modifiers: [
        { name: 'White Rice', priceAdjustment: 0 },
        { name: 'Jollof Rice', priceAdjustment: 0 },
        { name: 'Fried Rice', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 0 },
        { name: 'Beef', priceAdjustment: 500 },
        { name: 'Goat Meat', priceAdjustment: 1000 },
        { name: 'Catfish', priceAdjustment: 1000 },
      ]
    },
    {
      name: 'Indomie',
      price: 4500,
      modifiers: [
        { name: 'Egg', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 2000 },
      ]
    },
    {
      name: 'Spaghetti',
      price: 4500,
      modifiers: [
        { name: 'Egg', priceAdjustment: 0 },
        { name: 'Chicken', priceAdjustment: 2000 },
      ]
    }
  ];

  for (const itemData of newItems) {
    const product = await prisma.posProduct.create({
      data: {
        propertyId: property.id,
        categoryId: category.id,
        name: itemData.name,
        price: itemData.price,
        taxRate: 7.5,
        isActive: true
      }
    });

    if (itemData.modifiers && itemData.modifiers.length > 0) {
      for (const mod of itemData.modifiers) {
        await prisma.posProductModifier.create({
          data: {
            productId: product.id,
            name: mod.name,
            price: mod.priceAdjustment,
            isActive: true
          }
        });
      }
    }
    console.log(`Created ${itemData.name} with ${itemData.modifiers.length} modifiers.`);
  }

  console.log('✅ Updated Nigerian Main Course with smart modifiers!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
