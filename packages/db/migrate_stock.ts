import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PREPARED_FOOD_KEYWORDS = ['soup', 'rice', 'burger', 'combo', 'shawarma', 'fried', 'jollof', 'roast', 'meal', 'platter', 'salad', 'pasta', 'spaghetti', 'stew', 'suya', 'chips'];
const SELLABLE_KEYWORDS = ['water', 'coke', 'beer', 'bottle', 'can', 'pack', 'sprite', 'fanta', 'guinness', 'malt', 'heineken', 'juice', 'wine', 'vodka', 'gin', 'whiskey', 'rum', 'tequila', 'mineral'];

async function runMigration() {
  console.log('Starting transactional data migration...');
  
  await prisma.$transaction(async (tx) => {
    const stockItems = await tx.stockItem.findMany({
      where: { posProductId: { not: null } },
      include: {
        posProduct: { include: { recipe: true } },
        _count: { select: { transactions: true } }
      }
    });

    console.log(`Found ${stockItems.length} records to migrate.`);

    if (stockItems.length !== 20) {
      throw new Error(`Precondition failed: Expected exactly 20 records, found ${stockItems.length}`);
    }

    let sellableCount = 0;
    let cookedCount = 0;

    for (const item of stockItems) {
      const nameLower = item.name.toLowerCase();
      
      let isCooked = PREPARED_FOOD_KEYWORDS.some(kw => nameLower.includes(kw));
      let isSellable = SELLABLE_KEYWORDS.some(kw => nameLower.includes(kw));

      if (isCooked) {
        if (item._count.transactions > 0 || Number(item.quantityOnHand) > 0) {
          throw new Error(`Precondition failed: Fake stock ${item.name} has transactions or quantity.`);
        }
        await tx.stockItem.delete({ where: { id: item.id } });
        cookedCount++;
      } else if (isSellable) {
        if (item.posProduct?.recipe) {
          throw new Error(`Precondition failed: Recipe already exists for ${item.name}`);
        }
        if (!item.posProductId) {
          throw new Error(`Precondition failed: Missing posProductId on ${item.name}`);
        }

        const recipe = await tx.recipe.create({
          data: {
            propertyId: item.propertyId,
            posProductId: item.posProductId,
            targetMargin: 70,
            isActive: true,
          }
        });

        const version = await tx.recipeVersion.create({
          data: {
            recipeId: recipe.id,
            versionName: 'v1.0 (Auto-migrated)',
            isActive: true,
          }
        });

        await tx.recipeIngredient.create({
          data: {
            recipeVersionId: version.id,
            stockItemId: item.id,
            quantity: 1,
            unitOfMeasure: item.baseUnit,
          }
        });

        // DETACH posProductId so we can verify a clean DB
        await tx.stockItem.update({
          where: { id: item.id },
          data: { posProductId: null }
        });

        sellableCount++;
      } else {
        throw new Error(`Precondition failed: Ambiguous item found ${item.name}`);
      }
    }

    console.log(`Successfully migrated ${sellableCount} sellables to Recipes.`);
    console.log(`Successfully deleted ${cookedCount} fake stock items.`);

    // Postcondition
    const remaining = await tx.stockItem.count({ where: { posProductId: { not: null } } });
    if (remaining > 0) {
      throw new Error(`Postcondition failed: Found ${remaining} posProductId mappings still remaining.`);
    }

    console.log('All validations passed. Committing transaction...');
  }, { maxWait: 10000, timeout: 60000 });

  console.log('Migration committed successfully.');
}

runMigration()
  .catch(e => {
    console.error('Migration failed and rolled back:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
