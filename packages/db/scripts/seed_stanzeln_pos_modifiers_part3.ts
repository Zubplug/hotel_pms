import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Upgrading remaining complex items to use Modifiers...');

  const property = await prisma.property.findFirst();
  if (!property) throw new Error('No property found in production.');

  const categoryUpdates = [
    {
      categoryName: 'Dessert / Snacks',
      itemsToRemove: [
        'English breakfast (Tea/coffee,bread,eggs,sausages and baked beans)',
        'Continental Breakfast (fruit juice, coffee/tea, fruit cereal & bread)'
      ],
      newItems: [
        {
          name: 'English Breakfast',
          price: 5500,
          modifiers: ['Tea', 'Coffee', 'Fried Eggs', 'Scrambled Eggs', 'Boiled Eggs', 'Omelette']
        },
        {
          name: 'Continental Breakfast',
          price: 7000,
          modifiers: ['Tea', 'Coffee']
        }
      ]
    },
    {
      categoryName: 'Nigerian Extra',
      itemsToRemove: [
        'Soup',
        'Stew',
        'Swallow'
      ],
      newItems: [
        {
          name: 'Extra Soup Portion',
          price: 3000,
          modifiers: ['Egusi', 'Ogbono', 'Vegetable', 'Bitterleaf']
        },
        {
          name: 'Extra Stew Portion',
          price: 3000,
          modifiers: ['Chicken Stew', 'Beef Stew', 'Fish Stew', 'Plain Stew']
        },
        {
          name: 'Extra Swallow Portion',
          price: 3000,
          modifiers: ['Semo', 'Garri', 'Pando', 'Wheat']
        }
      ]
    }
  ];

  for (const update of categoryUpdates) {
    const category = await prisma.productCategory.findFirst({
      where: { name: update.categoryName }
    });

    if (!category) {
      console.error(`Category '${update.categoryName}' not found. Skipping.`);
      continue;
    }

    for (const itemName of update.itemsToRemove) {
      const existingItems = await prisma.posProduct.findMany({
        where: { categoryId: category.id, name: itemName }
      });

      for (const item of existingItems) {
        await prisma.posProductModifier.deleteMany({
          where: { productId: item.id }
        });
        await prisma.posProduct.delete({
          where: { id: item.id }
        });
        console.log(`Deleted old item: ${item.name}`);
      }
    }

    for (const itemData of update.newItems) {
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

      for (const modName of itemData.modifiers) {
        await prisma.posProductModifier.create({
          data: {
            productId: product.id,
            name: modName,
            price: 0,
            isActive: true
          }
        });
      }
      console.log(`Created ${itemData.name} with ${itemData.modifiers.length} modifiers.`);
    }
  }

  console.log('✅ Updated remaining complex items with smart modifiers!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
