import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Upgrading Dessert, Nigerian, and Nigerian Extra categories to use Modifiers...');

  const property = await prisma.property.findFirst();
  if (!property) throw new Error('No property found in production.');

  const outlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id }
  });
  if (!outlet) throw new Error('No outlet found.');

  const categoryUpdates = [
    {
      categoryName: 'Dessert / Snacks',
      itemsToRemove: [
        'Meat/Chicken pie/Fish roll',
        'Cereal (cornflakes/Rice Krispies/ Oatmeal)',
        'Eggs (poached/scrambled/boiled/omelette/sauce)'
      ],
      newItems: [
        {
          name: 'Pastry',
          price: 1000,
          modifiers: ['Meat Pie', 'Chicken Pie', 'Fish Roll']
        },
        {
          name: 'Cereal',
          price: 2000,
          modifiers: ['Cornflakes', 'Rice Krispies', 'Oatmeal']
        },
        {
          name: 'Eggs',
          price: 1300,
          modifiers: ['Poached', 'Scrambled', 'Boiled', 'Omelette', 'Sauce']
        }
      ]
    },
    {
      categoryName: 'Nigerian',
      itemsToRemove: [
        'Yam/plantain/potato: boiled/fried',
        'EXTRAS: beef/chicken sausage, baked beans, pancake'
      ],
      newItems: [
        {
          name: 'Carb Side (Yam/Plantain/Potato)',
          price: 3000,
          modifiers: ['Boiled Yam', 'Fried Yam', 'Boiled Plantain', 'Fried Plantain', 'Boiled Potato', 'Fried Potato']
        },
        {
          name: 'Breakfast Extras',
          price: 2500,
          modifiers: ['Beef Sausage', 'Chicken Sausage', 'Baked Beans', 'Pancake']
        }
      ]
    },
    {
      categoryName: 'Nigerian Extra',
      itemsToRemove: [
        'Chicken/Beef/Goat meat (peppered/fried/etc)',
        'Catfish/Gizzard/Cow leg',
        'Snail or Turkey',
        'Fried, Jollof or white rice'
      ],
      newItems: [
        {
          name: 'Protein (Standard)',
          price: 4000,
          modifiers: ['Chicken (Peppered)', 'Chicken (Fried)', 'Beef (Peppered)', 'Beef (Fried)', 'Goat Meat (Peppered)', 'Goat Meat (Fried)']
        },
        {
          name: 'Protein (Premium)',
          price: 5500,
          modifiers: ['Catfish', 'Gizzard', 'Cow Leg']
        },
        {
          name: 'Protein (Deluxe)',
          price: 6500,
          modifiers: ['Snail', 'Turkey']
        },
        {
          name: 'Rice Portion',
          price: 3000,
          modifiers: ['Fried Rice', 'Jollof Rice', 'White Rice']
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

    // Delete old items
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

    // Create new modifier items
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

  console.log('✅ Updated other categories with smart modifiers!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
